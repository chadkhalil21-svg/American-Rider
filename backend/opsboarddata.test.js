const assert=require('node:assert/strict');
const {loadOpsBoard,LIMITS}=require('./opsboarddata');
const now=Date.now();const rows={rides:[],operators:[],scheduled_rides:[],support_tickets:[],users:[]};
for(let i=0;i<180;i++)rows.rides.push({id:`r${i}`,status:'accepted',createdAt:now-1000,
  payoutPending:true,disputed:true,monitor:{state:'emergency'},receiptFailed:true});
for(let i=0;i<90;i++)rows.operators.push({id:`o${i}`,available:true});
for(let i=0;i<60;i++)rows.scheduled_rides.push({id:`s${i}`,status:'reserved',atMs:now+i});
for(let i=0;i<75;i++)rows.support_tickets.push({id:`t${i}`,status:'open',createdAt:now-i});
for(let i=0;i<90;i++)rows.users.push({id:`u${i}`,qualification:{status:'exception'}});
let returned=0,queries=0;
const failedCollections=new Set();
function query(name,filters=[],sort=null,bound=null){return {
 where(field,op,value){return query(name,[...filters,[field,op,value]],sort,bound);},
 orderBy(field,direction){return query(name,filters,[field,direction],bound);},
 limit(n){assert.ok(n>=1&&n<=120,`unbounded ${name} limit ${n}`);return query(name,filters,sort,n);},
 async get(){assert.ok(bound,`${name} collection read has no server limit`);queries++;
  if(failedCollections.has(name)){const err=new Error('9 FAILED_PRECONDITION: The query requires an index');err.code=9;throw err;}
  const value=(row,field)=>field.split('.').reduce((v,k)=>v?.[k],row);
  let found=rows[name].filter((row)=>filters.every(([field,op,expected])=>{
   const v=value(row,field);return op==='in'?expected.includes(v):op==='>'?v>expected:v===expected;
  }));
  if(sort)found.sort((a,b)=>{const x=value(a,sort[0]),y=value(b,sort[0]);return (x<y?-1:x>y?1:0)*(sort[1]==='desc'?-1:1);});
  const docs=found.slice(0,bound).map((row)=>({id:row.id,data:()=>({...row})}));returned+=docs.length;return {docs};
 }
};}
(async()=>{
 const data=await loadOpsBoard({collection:(name)=>query(name)},now-86_400_000);
 assert.equal(queries,Object.keys(LIMITS).length);
 assert.ok(returned<=Object.values(LIMITS).reduce((a,b)=>a+b,0));
 assert.equal(data.underway.rows.length,75);assert.equal(data.underway.saturated,true);
 assert.equal(data.recent.rows.length,120);assert.equal(data.recent.saturated,true);
 assert.equal(data.cases.rows.length,50);assert.equal(data.cases.saturated,true);
 assert.equal(data.operators.rows.length,75);assert.equal(data.pending.rows.length,50);
 assert.equal(Object.values(data).filter(group=>group.unavailable).length,0, 'healthy sections must be marked available');
 const failures=[];const oldError=console.error;
 try{
  console.error=(...items)=>failures.push(items.join(' '));
  failedCollections.add('support_tickets');
  const degraded=await loadOpsBoard({collection:(name)=>query(name)},now-86_400_000);
  assert.equal(degraded.cases.unavailable,true, 'failed index must mark cases unavailable, not zero cases');
  assert.equal(degraded.cases.rows.length,0);
  assert.equal(degraded.cases.reason,'index_required');
  assert.equal(degraded.underway.unavailable,false, 'other sections remain functional');
  assert.equal(degraded.underway.rows.length,75);
  assert.equal(degraded.pending.rows.length,50);
  assert.match(failures.join(' '),/Board section cases unavailable: index_required/);
  assert(!failures.join(' ').includes('FAILED_PRECONDITION:'), 'logs must not contain the raw Firestore error');
 }finally{console.error=oldError;failedCollections.clear();}
 console.log('PASS Operations board uses ten targeted bounded queries and exposes saturated samples, not million-row scans');
})().catch(e=>{console.error(e);process.exitCode=1;});
