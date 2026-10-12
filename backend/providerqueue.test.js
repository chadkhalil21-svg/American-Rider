const assert=require('node:assert');
const fs=require('fs'),path=require('path');
const {eventDocId,backoffMs,jitteredBackoffMs}=require('./providerqueue');
const R=[];const check=(l,c,d='')=>R.push({l,ok:!!c,d});
check('provider event ids deterministic',eventDocId('stripe','evt_123')===eventDocId('stripe','evt_123'));
check('provider namespaces prevent collision',eventDocId('stripe','1')!==eventDocId('checkr','1'));
check('retry backoff increases',backoffMs(2)>backoffMs(1));
check('retry backoff capped',backoffMs(100)<=15*60*1000);
// Two full passes, with 2,000 independent provider event identities each.
// Offline: no Firestore, Stripe, emails, or live money.
for(let pass=0;pass<2;pass++){
  const delays=[];
  const maximum=backoffMs(8);
  for(let i=0;i<2000;i++){
    const id=eventDocId('stripe','evt_test_'+i);
    const delay=jitteredBackoffMs(8,id);
    delays.push(delay);
    if(i<100){
      check('bounded deterministic retry '+pass+'/'+i,
        delay===jitteredBackoffMs(8,id) &&
        delay>=Math.floor(maximum/2) &&
        delay<=maximum);
    }
  }
  const unique=new Set(delays);
  check('2k failed events do not retry together pass '+pass,
    unique.size>1500, 'unique times: '+unique.size);
  for(const attempt of [1,2,3,6,12,25,100]){
    const id='stripe:evt_repeat_'+pass;
    const actual=jitteredBackoffMs(attempt,id);
    check('bounded recovery attempt '+pass+'/'+attempt,
      Number.isInteger(actual) && actual>=1 && actual<=backoffMs(attempt));
  }
  const a=jitteredBackoffMs(10,'stripe:evt_same');
  const b=jitteredBackoffMs(10,'stripe:evt_same');
  check('retry schedule stable across worker replays pass '+pass,a===b);
}
const queue=fs.readFileSync(path.join(__dirname,'providerqueue.js'),'utf8');
check('jitter is applied to failed events not initial delivery',
  /nextAttemptAt:dead\?0:Date\.now\(\)\+jitteredBackoffMs\(rec\.attempts,rec\.id\)/.test(queue));

const server=fs.readFileSync(path.join(__dirname,'server.js'),'utf8');
const a=server.indexOf('async function acceptDurableProviderEvent');
const b=server.indexOf("app.post('/stripe/webhook'",a);
const block=server.slice(a,b);
check('ACK follows bounded durable enqueue',block.indexOf('await enqueueWithDeadline(')>=0&&block.indexOf('enqueueProviderEvent({ provider, event })')>0&&block.indexOf('res.json({ received: true')>block.indexOf('await enqueueWithDeadline('));
check('queue outage returns 503',/!queued\.ok[\s\S]{0,450}status\(503\)/.test(block));
check('pending provider events are swept',/sweepProviderEvents/.test(server));
for(const r of R)console.log(`${r.ok?'PASS':'FAIL'}  ${r.l}${r.ok?'':' — '+r.d}`);
const bad=R.filter(r=>!r.ok);console.log(`\n${R.length-bad.length}/${R.length} passed`);assert.equal(bad.length,0);
