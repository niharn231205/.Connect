const {test}=require('node:test');const assert=require('node:assert/strict');
const {create,validate,score}=require('../../frontend/js/interview-archive');
const sample=()=>({id:'session-1',role:'Developer <script>',level:'Beginner',focus:'React',createdAt:'2026-10-29T00:00:00Z',completedAt:'2026-10-29T00:10:00Z',status:'completed',model:'test',questions:[{question:'Explain state.',referenceAnswer:'A reference.',answer:'My original answer\nwith Unicode: नमस्ते',evaluation:{score:75,feedback:'Good.',strengths:['Relevant'],improvements:['Add an example'],model:'test'}}]});
const memory=()=>{const map=new Map();return{getItem:k=>map.get(k)||null,setItem:(k,v)=>map.set(k,v)}};
test('complete transcript survives reload, JSON export/import and account separation',()=>{
    const storage=memory(),a=create(storage,'account-a');a.save(sample());
    const reopened=create(storage,'account-a');assert.equal(reopened.list()[0].questions[0].answer,sample().questions[0].answer);assert.equal(score(reopened.list()[0]),75);
    assert.equal(create(storage,'account-b').list().length,0);
    const other=create(memory(),'same');assert.equal(other.import(JSON.parse(JSON.stringify(reopened.export()))),1);assert.equal(other.import(reopened.export()),0);assert.deepEqual(other.list(),reopened.list());
});
test('malformed backups are rejected atomically, quota failures never evict history',()=>{
    const storage=memory(),a=create(storage,'journal');a.save(sample());const before=a.export();
    assert.throws(()=>a.import({version:1,sessions:[sample(),{bad:'data'}]}));assert.deepEqual(a.export().sessions,before.sessions);
    assert.throws(()=>validate({...sample(),questions:[{...sample().questions[0],evaluation:{score:1000}}]}));
    storage.setItem=()=>{throw new Error('QuotaExceededError');};assert.throws(()=>a.save({...sample(),id:'new'}));assert.equal(a.list().length,1);
});
