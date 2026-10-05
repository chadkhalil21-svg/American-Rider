const assert=require('node:assert/strict');
const path=require('node:path');
const rows=new Map();let emailOk=false,emailCalls=0;const subjects=[];
const doc=(id)=>({id,async get(){return {exists:rows.has(id),data:()=>rows.get(id)};},
 async create(v){if(rows.has(id))throw Error('already exists');rows.set(id,{...v});},
 async set(v,opts){rows.set(id,opts?.merge?{...rows.get(id),...v}:{...v});}});
const db={collection:()=>({doc})};
for(const [name,exports] of [
 ['firebase-admin.js',{adminDb:()=>db,adminStatus:()=>({reason:'not ready'})}],
 ['env.js',{readKey:(key)=>({SUPPORT_EMAIL:'support@example.test',RESEND_API_KEY:'fake'}[key]||'')}],
]){const p=require.resolve(path.join(__dirname,name));require.cache[p]={id:p,filename:p,loaded:true,exports,children:[],paths:[]};}
const {fileTicket}=require('./tickets');
const prior=global.fetch;
(async()=>{
 try{
  global.fetch=async(_url,options)=>{emailCalls++;subjects.push(JSON.parse(options.body).subject);return {ok:emailOk};};
  const args={uid:'u',email:'u@example.test',kind:'emergency',reason:'Emergency screen',
    description:'Help requested',idempotencyKey:'client-emergency-uuid-0001'};
  const first=await fileTicket(args);
  assert.equal(first.stored,true);assert.equal(first.emailed,false);
  assert.equal(rows.size,1);
  emailOk=true;
  const second=await fileTicket({...args,description:'New copy must not erase the first case'});
  assert.equal(second.caseNo,first.caseNo);assert.equal(second.stored,true);assert.equal(second.emailed,true);
  assert.equal(rows.get(first.caseNo).description,'Help requested');
  const third=await fileTicket(args);
  assert.equal(third.repeated,true);assert.equal(emailCalls,2,'an accepted alert is not resent on retry');
  assert.equal(rows.size,1);
  const fourth=await fileTicket({...args,idempotencyKey:'client-emergency-uuid-0002'});
  assert.notEqual(fourth.caseNo,first.caseNo);assert.equal(rows.size,2);
  assert.ok(subjects.slice(0,2).every((subject)=>subject.startsWith('EMERGENCY ·')));
  const financial=await fileTicket({uid:'stripe-system',kind:'emergency',reason:'Payment disputed',
    description:'Evidence due by provider deadline',idempotencyKey:'stripe-dispute-event-0001'});
  assert.equal(financial.stored,true);
  assert.match(subjects.at(-1),/^PAYMENT DEADLINE ·/);
  console.log('PASS emergency retries preserve one case, recover missing alert and distinguish new alarm');
 }finally{global.fetch=prior;}
})().catch(e=>{console.error(e);process.exitCode=1;});
