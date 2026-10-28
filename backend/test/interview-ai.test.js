const {test}=require('node:test');
const assert=require('node:assert/strict');
const {generateInterview,evaluateInterviewAnswer}=require('../services/interviewAiService');
const {createInterviewHandlers}=require('../controllers/aiInterviewController');
const express=require('express');
const {protect}=require('../middleware/authMiddleware');
const jwt=require('jsonwebtoken');
const context={role:'Frontend developer',level:'Beginner',focus:'React',count:3};
const questions=[1,2,3].map(n=>({question:'Question '+n,referenceAnswer:'A relevant reference answer.'}));
const evaluation={score:72,feedback:'Correct basic approach; add an example.',strengths:['Relevant reasoning'],improvements:['Discuss edge cases']};
function provider(value,status=200,finishReason='STOP') {return async(url,options)=>{
    assert.ok(!url.includes('test-key'));assert.equal(options.headers['x-goog-api-key'],'test-key');
    const body=JSON.parse(options.body);assert.match(body.systemInstruction.parts[0].text,/untrusted/);
    assert.equal(body.generationConfig.responseFormat.text.mimeType,'APPLICATION_JSON');
    return {ok:status===200,status,json:async()=>({candidates:[{finishReason,content:{parts:[{text:JSON.stringify(value)}]}}]})};
};}
const options=value=>({request:provider(value),wait:async()=>{},selectAlternate:async()=> 'test-model'});
test('AI generates role-specific structured Q&A and validates every question',async t=>{
    const old=process.env.GEMINI_API_KEY;t.after(()=>old===undefined?delete process.env.GEMINI_API_KEY:process.env.GEMINI_API_KEY=old);
    process.env.GEMINI_API_KEY='test-key';
    const result=await generateInterview(context,options({questions}));assert.equal(result.provider,'gemini');assert.deepEqual(result.questions,questions);
    for(const value of [{questions:[]},{questions:[...questions.slice(0,2),questions[0]]},{questions:questions.map(q=>({...q,referenceAnswer:''}))},null])
        await assert.rejects(generateInterview(context,options(value)),{code:'INTERVIEW_AI_UNAVAILABLE'});
});
test('AI feedback rejects fabricated success on missing key, outages, blocked or malformed output',async t=>{
    const old=process.env.GEMINI_API_KEY;t.after(()=>old===undefined?delete process.env.GEMINI_API_KEY:process.env.GEMINI_API_KEY=old);
    delete process.env.GEMINI_API_KEY;await assert.rejects(evaluateInterviewAnswer({},options(evaluation)),{status:503});
    process.env.GEMINI_API_KEY='test-key';
    const input={...context,question:'Explain state.',referenceAnswer:'State holds data.',answer:'State is data that can change.'};
    assert.equal((await evaluateInterviewAnswer(input,options(evaluation))).score,72);
    for(const value of [{...evaluation,score:101},{...evaluation,score:'72'},{...evaluation,strengths:['x'.repeat(701)]},{...evaluation,feedback:''},null])
        await assert.rejects(evaluateInterviewAnswer(input,options(value)),{status:503});
    await assert.rejects(evaluateInterviewAnswer(input,{...options(evaluation),request:provider(evaluation,503)}),{status:503});
    await assert.rejects(evaluateInterviewAnswer(input,{...options(evaluation),request:provider(evaluation,200,'SAFETY')}),{status:503});
    await assert.rejects(evaluateInterviewAnswer(input,{...options(evaluation),request:async()=>{throw new TypeError('network');}}),{status:503});
});
test('AI routes enforce auth, input limits, single-flight requests and a recoverable provider failure',async t=>{
    let finish;const pending=new Promise(resolve=>finish=resolve);
    const handlers=createInterviewHandlers({generateInterview:()=>pending,evaluateInterviewAnswer:async()=>{throw new Error('private provider body');}});
    const app=express();app.use(express.json());app.post('/generate',protect,handlers.generate);app.post('/evaluate',protect,handlers.evaluate);
    const server=app.listen(0);t.after(()=>server.close());await new Promise(resolve=>server.once('listening',resolve));
    const base='http://127.0.0.1:'+server.address().port;
    const call=(path,body,user)=>fetch(base+path,{method:'POST',headers:{'Content-Type':'application/json',...(user?{Authorization:'Bearer '+jwt.sign({id:user},process.env.JWT_SECRET||'fallback_secret')}: {})},body:JSON.stringify(body)});
    assert.equal((await call('/generate',context)).status,401);
    assert.equal((await call('/generate',{...context,count:100},'one')).status,400);
    const first=call('/generate',context,'one');
    // Wait for the service handler to enter, rather than a wall-clock delay.
    await new Promise(resolve=>setImmediate(resolve));
    let second=await call('/generate',context,'one');assert.ok([409,429].includes(second.status));
    finish({questions,provider:'gemini',model:'test'});assert.equal((await first).status,200);
    assert.equal((await call('/evaluate',{...context,question:'q',referenceAnswer:'r',answer:'a'.repeat(8001)},'two')).status,400);
    const failed=await call('/evaluate',{...context,question:'q',referenceAnswer:'r',answer:'answer'},'two');assert.equal(failed.status,503);assert.doesNotMatch(JSON.stringify(await failed.json()),/private provider body/);
});
