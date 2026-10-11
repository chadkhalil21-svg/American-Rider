'use strict';
// Google SRE requires bounded dependency waits and failure-visible acknowledgments.
// A provider MUST NOT receive 2xx before its signed event has been durably stored.
// https://sre.google/sre-book/reliable-product-launches/
// https://firebase.google.com/docs/firestore/use-rest-api
//
// When the deadline expires, we return a retryable failure. The original database
// request may still finish. A subsequent provider retry uses the same event ID,
// and providerqueue.js's create-only document makes that safe and idempotent.
const ACK_DEADLINE_MS=4000;
async function enqueueWithDeadline(enqueue,timeoutMs=ACK_DEADLINE_MS){
  if(typeof enqueue!=='function')return {ok:false,timedOut:false,reason:'no provider event writer'};
  if(!Number.isSafeInteger(timeoutMs)||timeoutMs<1||timeoutMs>10000)
    return {ok:false,timedOut:false,reason:'invalid provider receipt deadline'};
  let timer;
  try{
    return await Promise.race([
      Promise.resolve().then(enqueue).catch(()=>({ok:false,timedOut:false,reason:'provider event storage failed'})),
      new Promise(resolve=>{timer=setTimeout(()=>resolve({
        ok:false,timedOut:true,reason:'provider event durability not confirmed before deadline',
      }),timeoutMs);}),
    ]);
  }finally{if(timer)clearTimeout(timer);}
}
module.exports={ACK_DEADLINE_MS,enqueueWithDeadline};
