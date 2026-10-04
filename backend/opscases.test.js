const assert=require('node:assert/strict');
const {listOpsCases,actOnCase,PAGE_SIZE}=require('./opscases');
const rows=new Map();let auditNo=0;
for(let i=0;i<85;i++)rows.set(`support_tickets/AR-C-${String(i).padStart(6,'0')}`,{
 caseNo:`AR-C-${String(i).padStart(6,'0')}`,kind:'emergency',status:'open',createdAt:1000+i,
 reason:i===0?'Payment disputed':'Traveler requested help'});
rows.set('support_tickets/AR-C-SUPPORT',{caseNo:'AR-C-SUPPORT',kind:'support',status:'open',createdAt:1000});
function ref(col,id){const key=`${col}/${id}`;return {id,key,
 async get(){return {exists:rows.has(key),data:()=>structuredClone(rows.get(key)),id};},
 async set(data,opt){rows.set(key,opt?.merge?{...rows.get(key),...data}:data);}};}
const db={collection(col){return {doc(id){return ref(col,id||`audit-${++auditNo}`);},
 where(field,op,value){const filters=[[field,op,value]];let ordered=[],cursor=null,limit=null;
  const q={where(f,o,v){filters.push([f,o,v]);return q;},orderBy(field,dir='asc'){ordered.push([field,dir]);return q;},
  startAfter(snap){cursor={id:snap.id,createdAt:snap.data().createdAt};return q;},
  limit(n){limit=n;return q;},async get(){assert.ok(limit<=PAGE_SIZE+1);
   let docs=[...rows].filter(([key,r])=>key.startsWith(col+'/')&&filters.every(([f,o,v])=>o==='=='&&r[f]===v));
   assert.deepEqual(ordered,[['createdAt','asc'],['__name__','asc']]);
   docs.sort(([ak,a],[bk,b])=>a.createdAt-b.createdAt||ak.localeCompare(bk));
   if(cursor)docs=docs.filter(([key,r])=>r.createdAt>cursor.createdAt||r.createdAt===cursor.createdAt&&key.slice(col.length+1)>cursor.id);
   return {docs:docs.slice(0,limit).map(([key,r])=>({id:key.slice(col.length+1),data:()=>structuredClone(r)}))};
  }};return q;}};},
 async runTransaction(fn){const writes=[];const tx={get:(r)=>r.get(),update:(r,data)=>writes.push(()=>r.set(data,{merge:true})),
 create:(r,data)=>writes.push(async()=>{if(rows.has(r.key))throw new Error('duplicate audit');await r.set(data);})};
 const result=await fn(tx);for(const write of writes)await write();return result;}};
(async()=>{
 const first=await listOpsCases({db});assert.equal(first.cases.length,40);assert.equal(first.cases[0].id,'AR-C-000000');
 assert.equal(first.next,'AR-C-000039');
 const second=await listOpsCases({db,after:first.next});assert.equal(second.cases.length,40);assert.equal(second.next,'AR-C-000079');
 const last=await listOpsCases({db,after:second.next});assert.equal(last.cases.length,5);assert.equal(last.next,null);
 assert.equal((await listOpsCases({db,kind:'support'})).cases.length,1);
 assert.equal((await actOnCase({db,caseNo:first.cases[0].id,action:'close',actor:'alice',note:'Resolved after follow-up'})).code,'acknowledgement_required');
 assert.equal((await actOnCase({db,caseNo:first.cases[0].id,action:'acknowledge',actor:'',note:'I will take ownership'})).code,'named_ops_required');
 assert.equal((await actOnCase({db,caseNo:first.cases[0].id,action:'acknowledge',actor:'alice',note:'Too short'})).code,'note_required');
 const ack=await actOnCase({db,caseNo:first.cases[0].id,action:'acknowledge',actor:'alice',note:'I contacted the safety desk',now:2000});
 assert.equal(ack.ok,true);assert.equal(rows.get('support_tickets/'+first.cases[0].id).acknowledgedBy,'alice');
 assert.equal((await actOnCase({db,caseNo:first.cases[0].id,action:'acknowledge',actor:'alice',note:'I contacted the safety desk'})).unchanged,true);
 assert.equal((await actOnCase({db,caseNo:first.cases[0].id,action:'close',actor:'alice',note:'Provider and Traveler confirmed resolved',now:3000})).ok,true);
 assert.equal(rows.get('support_tickets/'+first.cases[0].id).status,'closed');
 assert.equal([...rows.keys()].filter((k)=>k.startsWith('audit_log/')).length,2);
 assert.equal((await listOpsCases({db})).cases[0].id,'AR-C-000001');
 console.log('PASS 85 urgent cases paginate; only named, noted acknowledge then auditable close is allowed');
})().catch(e=>{console.error(e);process.exitCode=1;});
