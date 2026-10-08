const assert=require('node:assert/strict');
const {codeFor,totpStep,sessionFor,verifySession,SESSION_MS}=require('./opssecurity');
const secret='GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ';
assert.equal(codeFor(secret,1),'287082','RFC 6238 SHA1 vector reduced to six digits');
assert.equal(totpStep(secret,'287082',59_000),1);
assert.equal(totpStep(secret,'not-a-code',59_000),null);
const acct={name:'alice',pw:'correct-horse-battery'};
const signing='secret-session-key-for-tests-123456789';
const session=sessionFor(acct,signing,1_000_000);
assert(verifySession(session,acct,signing,1_000_000+SESSION_MS));
assert(!verifySession(session,acct,signing,1_000_000+SESSION_MS+1));
assert(!verifySession(session,{...acct,pw:'rotated'},signing,1_000_001));
assert(!verifySession('alice.bad.cookie',acct,signing,1_000_001));

(async()=>{
  const keys=['RENDER','OPS_USERS','OPS_MFA_SECRETS','OPS_SESSION_SECRET'];
  const old=Object.fromEntries(keys.map((key)=>[key,process.env[key]]));
  try{
    process.env.RENDER='true';process.env.OPS_USERS='alice:correct-horse-battery';
    process.env.OPS_MFA_SECRETS=`alice:${secret}`;
    process.env.OPS_SESSION_SECRET=signing;
    const ops=require('./ops');
    assert.deepEqual(ops.opsConfigurationIssues(), [], 'valid Operations configuration is ready');
    process.env.OPS_MFA_SECRETS='alice:invalid-0';
    assert.match(ops.opsConfigurationIssues().join('; '), /OPS_MFA_SECRETS/, 'invalid MFA is diagnosed');
    process.env.OPS_MFA_SECRETS=`alice:${secret}`;
    process.env.OPS_SESSION_SECRET='short';
    assert.match(ops.opsConfigurationIssues().join('; '), /OPS_SESSION_SECRET/, 'short session secret is diagnosed');
    process.env.OPS_SESSION_SECRET=signing;
    process.env.OPS_USERS='alice:correct-horse-battery,bob:another-password';
    assert.match(ops.opsConfigurationIssues().join('; '), /bob/, 'all named accounts require MFA');
    process.env.OPS_USERS='alice:correct-horse-battery';
    assert.deepEqual(ops.opsConfigurationIssues(), [], 'configuration can recover');
    const routes={};
    const app={post:(path,...handlers)=>{routes[path]=handlers.at(-1);},get:()=>{}};
    const rows={};
    const ref=(id)=>({id,get:async()=>({exists:!!rows[id],data:()=>rows[id]})});
    const db={collection:()=>({doc:ref}),runTransaction:async(fn)=>{
      const pending=[];const result=await fn({get:(r)=>r.get(),set:(r,v)=>pending.push(()=>{rows[r.id]=v;})});
      pending.forEach((f)=>f());return result;
    }};
    ops.mount(app,{urlencoded:()=>()=>{}},{db:()=>db});
    const reply=()=>({statusCode:200,headers:{},setHeader(k,v){this.headers[k]=v;},
      status(n){this.statusCode=n;return this;},type(){return this;},send(text){this.text=text;return this;},
      redirect(n,url){this.statusCode=typeof n==='number'?n:302;this.url=url||n;return this;}});
    let r=reply();let code=codeFor(secret,Math.floor(Date.now()/30_000));
    await routes['/ops/enter']({body:{name:'alice',password:acct.pw,otp:code}},r);
    assert.equal(r.statusCode,302);
    assert.match(r.headers['Set-Cookie'],/SameSite=Strict/);
    const raw=r.headers['Set-Cookie'].split(';')[0];
    assert.equal(ops.signedIn({headers:{cookie:raw}}),'alice');
    r=reply();await routes['/ops/enter']({body:{name:'alice',password:acct.pw,otp:code}},r);
    await new Promise((resolve)=>setTimeout(resolve,750));
    assert.equal(r.statusCode,401,'one OTP can authenticate only once');
    assert.equal(ops.signedIn({headers:{cookie:`ar_ops=${encodeURIComponent('alice.'+ops.tokenFor(acct))}`}}),null);
    console.log('PASS RFC 6238, one-use privileged MFA, signed expiring session and dev-cookie rejection');
  }finally{for(const key of keys)if(old[key]===undefined)delete process.env[key];else process.env[key]=old[key];}
})().catch((e)=>{console.error(e);process.exitCode=1;});
