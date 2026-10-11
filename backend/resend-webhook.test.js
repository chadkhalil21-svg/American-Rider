'use strict';
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { verifyResendEvent } = require('./resend-webhook');
const { handleResendDeliveryEvent } = require('./resend-delivery');
const { policyFingerprint } = require('./insurance-contact-trust');
const NOW = Date.parse('2026-10-11T12:00:00Z');
const KEY = Buffer.alloc(32, 17);
const SECRET = 'whsec_' + KEY.toString('base64');
const MESSAGE = 'e8df8d21-a1d2-411e-a0e0-101abc888999';
const ADDR = 'provider@example.test';
const stamp = String(Math.floor(NOW / 1000));
const eventBody = (type, to = ADDR, id = MESSAGE) => ({
  type, created_at:new Date(NOW).toISOString(),
  data:{ email_id:id, to:[to], bounce:{type:'Permanent'} },
});
function signed(body, { id='msg_test_event_1', timestamp=stamp, payload } = {}) {
  const raw = Buffer.from(payload ?? JSON.stringify(body));
  const mac = crypto.createHmac('sha256', KEY)
    .update(Buffer.concat([Buffer.from(id + '.' + timestamp + '.'), raw]))
    .digest('base64');
  return {raw, headers:{id,timestamp,signature:'v1,' + mac}};
}
const expectReject = (fn) => assert.throws(fn);
const sample = signed(eventBody('email.delivered'));
const verified = verifyResendEvent(sample.raw,sample.headers,SECRET,NOW);
assert.equal(verified.type,'email.delivered');
assert.equal(verified.data.email_id,MESSAGE);
assert.equal(verified.data.recipient,ADDR);
expectReject(()=>verifyResendEvent(sample.raw, {...sample.headers,signature:'v1,badsignature'},SECRET,NOW));
expectReject(()=>verifyResendEvent(Buffer.from(sample.raw.toString()+' '),sample.headers,SECRET,NOW));
expectReject(()=>verifyResendEvent(sample.raw,{...sample.headers,id:'another'},SECRET,NOW));
expectReject(()=>verifyResendEvent(sample.raw,{...sample.headers,timestamp:String(Number(stamp)-301)},SECRET,NOW));
expectReject(()=>verifyResendEvent(sample.raw,{...sample.headers,timestamp:String(Number(stamp)+301)},SECRET,NOW));
expectReject(()=>verifyResendEvent(sample.raw,sample.headers,'',NOW));
expectReject(()=>verifyResendEvent(Buffer.alloc(32769),sample.headers,SECRET,NOW));
const plural = {...sample.headers,signature:'v1,wrong '+sample.headers.signature};
assert.equal(verifyResendEvent(sample.raw,plural,SECRET,NOW).type,'email.delivered');
const unicode = signed(eventBody('email.delivered'),{payload:JSON.stringify({...eventBody('email.delivered'),name:'Ação'})});
assert.equal(verifyResendEvent(unicode.raw,unicode.headers,SECRET,NOW).type,'email.delivered');
assert.equal(verifyResendEvent(signed(eventBody('contact.created')).raw,
  signed(eventBody('contact.created')).headers, SECRET, NOW),null);

function memory() {
  const requests = new Map(), users = new Map();
  let writes=0, fail=false;
  const ref = (collection,id) => ({collection,id,
    get:async()=>({exists:(collection==='requests'?requests:users).has(id),
      data:()=>structuredClone((collection==='requests'?requests:users).get(id))})});
  const db = {
    collection(name) {
      if(name==='insurance_status_requests')return {
        where:(field,compare,value)=>{
          assert.equal(field,'providerMessageId');assert.equal(compare,'==');
          return { limit:n=>{assert.equal(n,2);return {get:async()=>{
            if(fail)throw new Error('database quota unavailable');
            const docs=[...requests].filter(([,r])=>r.providerMessageId===value)
              .slice(0,n).map(([id])=>({id,ref:ref('requests',id)}));
            return {docs};
          }};}};
        },
      };
      assert.equal(name,'users');
      return {doc:id=>ref('users',id)};
    },
    async runTransaction(fn){
      if(fail)throw new Error('database quota unavailable');
      const pending=[];
      const out=await fn({
        get:r=>r.get(),
        set:(r,patch)=>pending.push(()=>{
          const o=requests.get(r.id);requests.set(r.id,{...o,...structuredClone(patch)});writes++;
        }),
        update:(r,patch)=>pending.push(()=>{
          const o=users.get(r.id);
          for(const [key,value] of Object.entries(patch)){
            assert.equal(key,'insuranceMonitoring.verificationIssue');
            o.insuranceMonitoring.verificationIssue=structuredClone(value);
          }
          writes++;
        }),
      });
      for(const cb of pending)cb();
      return out;
    },
  };
  return {db,requests,users,getWrites:()=>writes,setFailure:v=>{fail=v;}};
}
const m = () => ({insurer:'Example', policyNumber:'SYNTHETIC-1',
  effectiveDate:'2026-01-01',expirationDate:'2027-01-01',
  status:'unverified',lastVerifiedAt:NOW-40*86400000,
  verificationRequestedAt:NOW-1000,verificationRequestedTo:ADDR,
  verificationIssue:null});
function seed(h,id='req1') {
  const monitoring=m();
  h.users.set('op1',{insuranceMonitoring:monitoring});
  h.requests.set(id,{uid:'op1',email:ADDR,providerMessageId:MESSAGE,
    policyFingerprint:policyFingerprint(monitoring),createdAt:NOW-1000,
    deliveryStatus:'accepted',usedAt:null});
}
const event = (type,id='evt1',address=ADDR,email=MESSAGE) => ({
  id,type,data:{recipient:address,email_id:email},
});
(async()=>{
  const h=memory();seed(h);
  let out=await handleResendDeliveryEvent(event('email.delivered'),{db:h.db,now:NOW});
  assert.equal(out.deliveryStatus,'delivered');
  assert.equal(h.requests.get('req1').deliveryStatus,'delivered');
  assert.equal(h.users.get('op1').insuranceMonitoring.lastVerifiedAt,m().lastVerifiedAt);
  assert.equal(h.users.get('op1').insuranceMonitoring.status,'unverified',
    'delivery NEVER confirms active insurance');
  const writes=h.getWrites();
  out=await handleResendDeliveryEvent(event('email.sent'),{db:h.db,now:NOW+1});
  assert.equal(out.unchanged,true);
  assert.equal(h.getWrites(),writes,'out-of-order sent does not downgrade delivery');
  out=await handleResendDeliveryEvent(event('email.bounced'),{db:h.db,now:NOW+2});
  assert.equal(out.operatorActionRequired,true);
  assert.equal(h.requests.get('req1').deliveryStatus,'bounced');
  assert.equal(h.users.get('op1').insuranceMonitoring.verificationIssue.kind,'email_bounced');
  assert.equal(h.users.get('op1').insuranceMonitoring.status,'unverified');
  assert.equal(h.users.get('op1').insuranceMonitoring.lastVerifiedAt,m().lastVerifiedAt);
  const after=h.getWrites();
  out=await handleResendDeliveryEvent(event('email.bounced'),{db:h.db,now:NOW+3});
  assert.equal(out.unchanged,true);
  out=await handleResendDeliveryEvent(event('email.delivered'),{db:h.db,now:NOW+4});
  assert.equal(out.unchanged,true);
  assert.equal(h.getWrites(),after,'duplicates and late lower-priority events write nothing');
  out=await handleResendDeliveryEvent(event('email.bounced','evt', 'wrong@example.test'),{db:h.db,now:NOW});
  assert.equal(out.ignored,true);
  out=await handleResendDeliveryEvent(event('email.bounced','evt',ADDR,'other_message'),{db:h.db,now:NOW});
  assert.equal(out.ignored,true);
  const moved=memory();seed(moved);
  moved.users.get('op1').insuranceMonitoring.policyNumber='NEW-POLICY';
  out=await handleResendDeliveryEvent(event('email.failed'),{db:moved.db,now:NOW});
  assert.equal(out.operatorActionRequired,false,'old policy event must not alter current case');
  assert.equal(moved.users.get('op1').insuranceMonitoring.verificationIssue,null);
  const confirmed=memory();seed(confirmed);
  confirmed.users.get('op1').insuranceMonitoring.lastVerifiedAt=NOW;
  out=await handleResendDeliveryEvent(event('email.suppressed'),{db:confirmed.db,now:NOW+1});
  assert.equal(out.operatorActionRequired,false,'old bounce must not undo newer insurer confirmation');
  const outage=memory();seed(outage);outage.setFailure(true);
  await assert.rejects(()=>handleResendDeliveryEvent(event('email.bounced'),{db:outage.db,now:NOW}),/quota/);
  assert.equal(outage.requests.get('req1').deliveryStatus,'accepted',
    'failed database write must remain retryable, not falsely acknowledged');
  const source=fs.readFileSync(path.join(__dirname,'server.js'),'utf8');
  const route=source.indexOf("app.post('/resend/webhook'");
  const bodyParser=source.indexOf('app.use(express.json())');
  assert(route>0 && route<bodyParser,'Resend webhook must precede JSON parser');
  assert(source.includes("express.raw({ type: 'application/json', limit: '32kb' })"));
  assert(source.includes("resend: handleResendDeliveryEvent"));
  assert(source.includes("acceptDurableProviderEvent('resend', event, res)"));
  console.log('PASS signed Resend events, malformed/stale/replay data, exact-message and policy correlation, 24 transport/eligibility assertions');
})().catch(e=>{console.error(e);process.exitCode=1;});
