const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {finalizeAccountDeletion,sweepAccountDeletion}=require('./accountdeletion');

function fixture(){
 const rows=new Map([['users/u',{name:'Example',email:'example.invalid'}],['waitlist/u',{area:'25:-80'}]]);
 let failProfile=false,authRemoved=false,authFails=false,deletes=0;
 const ref=(collection,id)=>({id,path:`${collection}/${id}`,collection,
  async get(){return {id,ref:this,exists:rows.has(this.path),data:()=>rows.get(this.path)};},
  async set(value,o){rows.set(this.path,o?.merge?{...rows.get(this.path),...value}:value);},
  async update(value){assert(rows.has(this.path));rows.set(this.path,{...rows.get(this.path),...value});},
  async delete(){if(this.path==='users/u'&&failProfile){failProfile=false;throw new Error('Firestore interrupted');}rows.delete(this.path);},
 });
 const db={collection(name){return {doc(id){return ref(name,id);},where(field,op,value){
   return {orderBy(){return this;},limit(n){this.limitCount=n;return this;},
    async get(){const docs=[...rows].filter(([path,data])=>path.startsWith(name+'/')&&
      (op==='=='?data[field]===value:op==='<='&&Number(data[field])<=value))
      .slice(0,this.limitCount||100).map(([path])=>({id:path.slice(name.length+1),ref:ref(name,path.slice(name.length+1)),data:()=>rows.get(path)}));
      return {docs,size:docs.length};},};},};},
  async runTransaction(fn){const writes=[];const out=await fn({get:(r)=>r.get(),
   set:(r,v,o)=>writes.push(()=>r.set(v,o)),update:(r,v)=>writes.push(()=>r.update(v)),
   delete:(r)=>writes.push(()=>r.delete())});for(const w of writes)await w();return out;},};
 const auth={async deleteUser(uid){assert.equal(uid,'u');deletes++;if(authFails){const e=new Error('provider outage');e.code='auth/unavailable';throw e;}authRemoved=true;},
  async getUser(uid){assert.equal(uid,'u');if(authRemoved){const e=new Error('not found');e.code='auth/user-not-found';throw e;}return {uid};}};
 return {rows,db,auth,setAuthFailure:(v)=>authFails=v,setProfileFailure:(v)=>failProfile=v,setAuthRemoved:(v)=>authRemoved=v,get deletes(){return deletes;}};
}
(async()=>{
 const server=fs.readFileSync(path.join(__dirname,'server.js'),'utf8');
 const client=fs.readFileSync(path.join(__dirname,'../src/state/AuthContext.tsx'),'utf8');
 assert.match(server,/app\.post\('\/account\/delete', requireAuth, requireFreshAuth,/);
 assert.match(server,/verified\.auth_time/);
 assert.match(server,/app\.post\('\/account\/close', requireAuth,[\s\S]{0,150}productionMode[\s\S]{0,120}426/);
 assert.match(client,/await deleteAccountOnServer\(\)/);
 assert.doesNotMatch(client,/deleteDoc\(doc\(db, 'users', u\.uid\)\)/);
 const deletionBlock=client.slice(client.indexOf('deleteAccount: (reauthenticate) =>'),client.indexOf('    signOut: () =>'));
 assert.doesNotMatch(deletionBlock,/await clearPushToken\(\)/,
   'a rejected active-Travel deletion must not disable push or safety communications');
 assert.match(deletionBlock,/await deleteAccountOnServer\(\);[\s\S]*await clearAllStorage\(\)/,
   'local erasure must occur only after a successful server deletion response');
 assert.doesNotMatch(deletionBlock,/getIdToken\(true\)[\s\S]*clearAllStorage\(\)/,
   'a transient refresh failure cannot prove account deletion or erase local data');
 const base=fixture();const done=await finalizeAccountDeletion({db:base.db,auth:base.auth,uid:'u',now:1000});
 assert.deepEqual(done,{ok:true,profileRemoved:true});assert.equal(base.deletes,1);
 assert.equal(base.rows.has('users/u'),false);assert.equal(base.rows.has('account_closures/u'),false);
 assert.equal(base.rows.get('operators/u').available,false);
 const missing=await sweepAccountDeletion({db:base.db,auth:base.auth,now:100000});assert.equal(missing.considered,0);

 const failed=fixture();failed.setAuthFailure(true);
 const blocked=await finalizeAccountDeletion({db:failed.db,auth:failed.auth,uid:'u',now:2000});
 assert.equal(blocked.code,'auth_delete_failed');assert.equal(failed.rows.has('users/u'),true,'provider failure must not erase a live account profile');
 assert.equal(failed.rows.get('account_closures/u').state,'failed');
 failed.setAuthFailure(false);
 const retried=await finalizeAccountDeletion({db:failed.db,auth:failed.auth,uid:'u',now:3000});
 assert.equal(retried.profileRemoved,true);assert.equal(failed.rows.has('users/u'),false);

 const orphan=fixture();orphan.setProfileFailure(true);
 const pending=await finalizeAccountDeletion({db:orphan.db,auth:orphan.auth,uid:'u',now:4000});
 assert.equal(pending.profileCleanupPending,true);assert.equal(orphan.rows.has('users/u'),true);
 assert.equal(orphan.rows.get('account_closures/u').state,'auth_deleted');
 const swept=await sweepAccountDeletion({db:orphan.db,auth:orphan.auth,now:64001});
 assert.equal(swept.cleaned,1);assert.equal(orphan.rows.has('users/u'),false);assert.equal(orphan.rows.has('account_closures/u'),false);
 const live=fixture();live.rows.set('rides/r1',{travelerUid:'u',status:'awaiting_payment'});
 const refused=await finalizeAccountDeletion({db:live.db,auth:live.auth,uid:'u',now:5000});
 assert.equal(refused.code,'active_travel');assert.equal(live.deletes,0);assert.equal(live.rows.has('users/u'),true);

 const still=fixture();still.rows.set('account_closures/u',{closingAt:1,state:'failed',nextCheckAt:10});
 const skipped=await sweepAccountDeletion({db:still.db,auth:still.auth,now:100000});
 assert.equal(skipped.cleaned,0);assert.equal(still.rows.has('users/u'),true,'worker must never delete a live Firebase identity');
 assert.ok(still.rows.get('account_closures/u').nextCheckAt>100000);
 console.log('PASS recent-login deletion service, provider failure retry, orphan profile recovery and live-account refusal');
})().catch(e=>{console.error(e);process.exitCode=1;});
