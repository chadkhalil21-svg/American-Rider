const assert=require('node:assert/strict');
const Module=require('node:module');
const {readReply}=require('./monitor');
const before=process.env.ANTHROPIC_API_KEY,load=Module._load;
let modelLoads=0;
(async()=>{
 try{
  process.env.ANTHROPIC_API_KEY='test-only-not-a-real-key';
  Module._load=function(id,...rest){if(id==='@anthropic-ai/sdk'){modelLoads++;throw Error('Model must not classify a known urgent reply');}return load.call(this,id,...rest);};
  const response=await readReply({reply:'We were injured in a collision. Call 911.',stillMin:8,stage:'onboard'});
  assert.equal(response.urgent,true);assert.equal(response.resolved,false);assert.equal(modelLoads,0);
  delete process.env.ANTHROPIC_API_KEY;
  const traffic=await readReply({reply:'An accident up ahead has slowed traffic.',stillMin:6,stage:'accepted'});
  assert.equal(traffic.urgent,false);assert.equal(traffic.resolved,true);
  console.log('PASS deterministic incident escalation outranks model; ordinary traffic is not an emergency');
 }finally{Module._load=load;if(before===undefined)delete process.env.ANTHROPIC_API_KEY;else process.env.ANTHROPIC_API_KEY=before;}
})().catch(e=>{console.error(e);process.exitCode=1;});
