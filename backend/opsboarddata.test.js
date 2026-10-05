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
function query(name,filters=[],sort=null,bound=null){return {
 where(field,op,value){return query(name,[...filters,[field,op,value]],sort,bound);},
 orderBy(field,direction){return query(name,filters,[field,direction],bound);},
 limit(n){assert.ok(n>=1&&n<=120,`unbounded ${name} limit ${n}`);return query(name,filters,sort,n);},
 async get(){assert.ok(bound,`${name} collection read has no server limit`);queries++;
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
 console.log('PASS Operations board uses ten targeted bounded queries and exposes saturated samples, not million-row scans');
})().catch(e=>{console.error(e);process.exitCode=1;});
