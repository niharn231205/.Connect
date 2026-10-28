const {test}=require('node:test');const assert=require('node:assert/strict');
const {generateCareerAdvice,redactContacts}=require('../services/careerAdviceService');
const {createCareerAdvice}=require('../controllers/careerAdviceController');
const express=require('express');const jwt=require('jsonwebtoken');const {protect}=require('../middleware/authMiddleware');
const resumeText='Alex Example\nalex@example.invalid | +91 9000000000\nEducation: Computer Science student.\nSkills: Python, JavaScript, SQL.\nProjects: Built a library portal using Python and SQLite.';
const advice=()=>({summary:'Explore entry-level development and data roles.',roles:['Software developer intern','Junior data analyst','QA trainee'].map(title=>({title,fit:'closer_fit',why:'Your projects and skills provide a relevant starting point.',evidence:['Skills: Python, JavaScript, SQL.'],skillsToBuild:['Testing'],nextStep:'Add tests to your library portal.'})),nextSteps:['Build a tested project.','Prepare examples from your work.'],resumeImprovements:['Explain your personal contribution to the portal.'],jobFitNotes:'Compare the listed testing requirements.'});
const accepted=()=>({verifiedByAI:true,extractedText:resumeText,verifiedAt:'2026-10-29T00:00:00Z',verification:{isResume:true,confidence:1,documentType:'resume',provider:'gemini'}});
const reply=()=>({statusCode:200,status(n){this.statusCode=n;return this;},json(body){this.body=body;return this;}});
const opts=value=>({request:async(url,options)=>{
    assert.equal(options.headers['x-goog-api-key'],'test-key');assert.ok(!url.includes('test-key'));
    const body=JSON.parse(options.body),input=JSON.parse(body.contents[0].parts[0].text);
    assert.ok(!input.resumeText.includes('alex@example.invalid'));assert.ok(!input.resumeText.includes('9000000000'));
    assert.match(body.systemInstruction.parts[0].text,/untrusted/);assert.match(body.systemInstruction.parts[0].text,/protected traits/);
    return{ok:true,status:200,json:async()=>({candidates:[{finishReason:'STOP',content:{parts:[{text:JSON.stringify(value)}]}}]})};
},wait:async()=>{},selectAlternate:async()=> 'test-model'});

test('career AI returns structured roles backed by verbatim resume evidence and masks contacts',async t=>{
    const old=process.env.GEMINI_API_KEY;t.after(()=>old===undefined?delete process.env.GEMINI_API_KEY:process.env.GEMINI_API_KEY=old);process.env.GEMINI_API_KEY='test-key';
    const result=await generateCareerAdvice({resumeText,jdText:'Python developer'},opts(advice()));assert.equal(result.roles.length,3);assert.equal(result.provider,'gemini');
    assert.equal((await generateCareerAdvice({resumeText},opts(advice()))).jobFitNotes,'');
    assert.match(redactContacts('Use 2023-2027; call +91 9000000000 or a@b.com'),/2023-2027/);
});
test('career AI rejects invented evidence, malformed output, missing configuration and outages',async t=>{
    const old=process.env.GEMINI_API_KEY;t.after(()=>old===undefined?delete process.env.GEMINI_API_KEY:process.env.GEMINI_API_KEY=old);process.env.GEMINI_API_KEY='test-key';
    const unsupported=advice();unsupported.roles[0].evidence=['Ten years of management experience'];
    const duplicate=advice();duplicate.roles[2].title=duplicate.roles[0].title;
    for(const bad of [unsupported,duplicate,{...advice(),roles:[]},{...advice(),nextSteps:'learn'},null])await assert.rejects(generateCareerAdvice({resumeText},opts(bad)),{code:'CAREER_AI_UNAVAILABLE'});
    delete process.env.GEMINI_API_KEY;await assert.rejects(generateCareerAdvice({resumeText},opts(advice())),{status:503});process.env.GEMINI_API_KEY='test-key';
    await assert.rejects(generateCareerAdvice({resumeText},{...opts(advice()),request:async()=>({ok:false,status:503})}),{status:503});
    await assert.rejects(generateCareerAdvice({resumeText},{...opts(advice()),request:async()=>({ok:true,status:200,json:async()=>({candidates:[{finishReason:'SAFETY'}]})})}),{status:503});
});
test('advice uses only the signed-in verified resume and caches by resume and JD',async()=>{
    const user={id:'one',resume:accepted()};let calls=0,lastInput,time=Date.now();
    const handler=createCareerAdvice({database:{findUserById:id=>id===user.id?user:null},now:()=>time,recommend:async input=>{calls++;lastInput=input;return advice();}});
    const request={user:{id:'one'},body:{jdText:'Python developer',resumeText:'Forged content',userId:'another-user'}};
    let res=reply();await handler(request,res);assert.equal(res.statusCode,200);assert.equal(lastInput.resumeText,resumeText);assert.equal(res.body.context,'resume_and_job_description');
    res=reply();await handler(request,res);assert.equal(calls,1);assert.equal(res.body.cached,true);
    request.body.jdText='SQL analyst';await handler(request,reply());assert.equal(calls,2);
    user.resume.verifiedAt='2026-10-30T00:00:00Z';await handler(request,reply());assert.equal(calls,3);
    time+=31*60000;await handler(request,reply());assert.equal(calls,4);
    user.resume.verifiedByAI=false;res=reply();await handler(request,res);assert.equal(res.statusCode,422);assert.equal(calls,4);
    user.resume.verifiedByAI=true;user.resume.verification.confidence=2;res=reply();await handler(request,res);assert.equal(res.statusCode,422);assert.equal(calls,4);
});
test('advice refuses stale resumes, concurrent requests and provider failures without changing the profile',async()=>{
    const user={id:'one',resume:accepted()};let release;
    const waiting=new Promise(resolve=>release=resolve);
    const handler=createCareerAdvice({database:{findUserById:()=>user},recommend:()=>waiting});
    const req={user:{id:'one'},body:{jdText:''}},first=reply(),pending=handler(req,first);const concurrent=reply();await handler(req,concurrent);assert.equal(concurrent.statusCode,409);
    user.resume.verifiedAt='changed';release(advice());await pending;assert.equal(first.statusCode,409);assert.equal(first.body.code,'RESUME_CHANGED');
    const snapshot=JSON.stringify(user);const failed=createCareerAdvice({database:{findUserById:()=>user},recommend:async()=>{throw Error('private provider body');}});const res=reply();await failed(req,res);assert.equal(res.statusCode,503);assert.doesNotMatch(JSON.stringify(res.body),/private provider body/);assert.equal(JSON.stringify(user),snapshot);
});
test('career route requires auth and returns actionable missing-resume and input errors',async t=>{
    const handler=createCareerAdvice({database:{findUserById:id=>id==='missing'?null:{id,resume:null}},recommend:async()=>{throw Error('must not be called');}});
    const app=express();app.use(express.json());app.post('/advice',protect,handler);const server=app.listen(0);t.after(()=>server.close());await new Promise(resolve=>server.once('listening',resolve));
    const call=(body,id)=>fetch('http://127.0.0.1:'+server.address().port+'/advice',{method:'POST',headers:{'Content-Type':'application/json',...(id?{Authorization:'Bearer '+jwt.sign({id},process.env.JWT_SECRET||'fallback_secret')}: {})},body:JSON.stringify(body)});
    assert.equal((await call({})).status,401);assert.equal((await call({jdText:[]},'one')).status,400);assert.equal((await call({jdText:'x'.repeat(15001)},'one')).status,400);
    assert.equal((await call({},'missing')).status,404);const noResume=await call({},'one');assert.equal(noResume.status,422);assert.equal((await noResume.json()).code,'VERIFIED_RESUME_REQUIRED');
});
