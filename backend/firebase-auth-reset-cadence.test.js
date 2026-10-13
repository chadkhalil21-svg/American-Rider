'use strict';
// Run the production Firebase commissioning script OFFLINE against a strict HTTP
// fake. Preserve a genuine per-PR account/login test but prohibit reset emails
// on every PR push. One scheduled or explicitly authorized reset/day.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const source=fs.readFileSync('scripts/commission-live-firebase-auth.cjs','utf8');
async function drill(reset,quotaExceeded=false){
  const calls=[],logs=[],errors=[],env={
    GITHUB_RUN_ID:'synthetic-no-network',
    TEST_FIREBASE_PASSWORD_RESET:reset?'true':'false',
  };
  const proc={env,exitCode:0};
  async function fetch(url,options){
    const u=new URL(url);
    const action=u.pathname.includes('securetoken')?'refresh':u.pathname.split(':').at(-1);
    calls.push(action);
    let body;
    if(options.headers?.['content-type']==='application/x-www-form-urlencoded'){
      body=Object.fromEntries(new URLSearchParams(options.body));
    }else body=JSON.parse(options.body);
    if(action==='signUp')return {ok:true,json:async()=>({
      localId:'synthetic-user',idToken:'fake-token1',refreshToken:'fake-refresh1',
    })};
    if(action==='lookup')return {ok:true,json:async()=>({
      users:[{localId:'synthetic-user'}],
    })};
    if(action==='refresh')return {ok:true,json:async()=>({
      user_id:'synthetic-user',id_token:'fake-token2',refresh_token:'fake-refresh2',
    })};
    if(action==='signInWithPassword'){
      if(body.password?.endsWith('-wrong'))return {ok:false,json:async()=>({
        error:{message:'INVALID_PASSWORD'},
      })};
      return {ok:true,json:async()=>({
        localId:'synthetic-user',idToken:'fake-token3',refreshToken:'fake-refresh3',
      })};
    }
    if(action==='sendOobCode'){
      assert.equal(body.requestType,'PASSWORD_RESET');
      if(quotaExceeded)return {ok:false,json:async()=>({
        error:{message:'QUOTA_EXCEEDED'},
      })};
      return {ok:true,json:async()=>({email:body.email})};
    }
    if(action==='delete')return {ok:true,json:async()=>({})};
    throw Error('unexpected real API request '+action);
  }
  // vm result is the async IIFE's Promise. No actual internet access.
  const context={require,process:proc,Date,URL,URLSearchParams,fetch,
    console:{log:(...x)=>logs.push(x.join(' ')),
      error:(...x)=>errors.push(x.join(' '))}};
  await vm.runInNewContext(source,context,{timeout:1000});
  return {calls,logs,errors,code:proc.exitCode};
}
(async()=>{
 for(let pass=1;pass<=2;pass++){
  const ordinary=await drill(false);
  assert.equal(ordinary.code,0);
  assert.ok(ordinary.logs.includes('LIVE_FIREBASE_AUTH_COMMISSIONING=PASS'));
  assert.equal(ordinary.calls.filter(x=>x==='sendOobCode').length,0,
    'PR releases may not spend Firebase reset quota');
  assert.equal(ordinary.calls.filter(x=>x==='delete').length,1,
    'test users must be cleaned up');
  const scheduled=await drill(true);
  assert.equal(scheduled.code,0);
  assert.equal(scheduled.calls.filter(x=>x==='sendOobCode').length,1,
    'scheduled/manual proof still exercises actual provider reset path');
  assert.equal(scheduled.calls.filter(x=>x==='delete').length,1);
  const denied=await drill(true,true);
  assert.equal(denied.code,1,'genuine reset quota must not be falsely called success');
  assert.ok(denied.errors.some(x=>x.includes('QUOTA_EXCEEDED')));
  assert.equal(denied.calls.filter(x=>x==='delete').length,1);
 }
 console.log('PASS TWICE synthetic Firebase auth commissioning: PR reset quota conserved, one scheduled reset, quota failure reported, cleanup always; no actual email/API');
})().catch(e=>{console.error(e);process.exitCode=1});
