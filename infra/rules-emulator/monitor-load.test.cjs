'use strict';
// Real Firestore emulator only. This test creates no customer records, real
// bookings, provider callbacks or charges. It is NOT a cloud-load certificate.
const assert = require('node:assert/strict');
const path = require('node:path');
const { performance } = require('node:perf_hooks');
const { createRequire } = require('node:module');
const backendRequire = createRequire(path.join(__dirname, '../../backend/package.json'));
const { initializeApp, getApps } = backendRequire('firebase-admin/app');
const { getFirestore } = backendRequire('firebase-admin/firestore');
if (!process.env.FIRESTORE_EMULATOR_HOST) throw Error('Firestore emulator required');
if (!getApps().length) initializeApp({ projectId: 'demo-american-rider' });
const db = getFirestore();
const RECORDS = 1201;
const PAGE_SIZE = 200;
const stages = ['accepted', 'arrived', 'onboard'];
async function main() {
  let batch=db.batch(),queued=0;
  const commit=async()=>{if(queued){await batch.commit();batch=db.batch();queued=0;}};
  for(let i=0;i<RECORDS;i++){
    const id='synthetic_monitor_'+String(i).padStart(5,'0');
    batch.set(db.collection('rides').doc(id),{
      status:stages[i%stages.length],operatorId:'synthetic',
      travelerUid:'synthetic',createdAt:1700000000000,
      opLat:25.7617,opLng:-80.1918,
    });
    if(++queued===350) await commit();
  }
  for(let i=0;i<13;i++){
    batch.set(db.collection('rides').doc('synthetic_excluded_'+i),{
      status:'cancelled',createdAt:1700000000000,
    });
    if(++queued===350) await commit();
  }
  await commit();
  const passes=[];
  for(let pass=1;pass<=2;pass++){
    const start=performance.now(),seen=new Set();let cursor=null,pages=0;
    for(;;){
      let q=db.collection('rides').where('status','in',stages).orderBy('__name__');
      if(cursor)q=q.startAfter(cursor);
      const snap=await q.limit(PAGE_SIZE).get();
      pages++;
      for(const doc of snap.docs){
        assert.ok(!seen.has(doc.id),'No duplicate pages');
        assert.ok(stages.includes(doc.data().status),'Exclude completed/cancelled Travels');
        seen.add(doc.id);
      }
      if(snap.size<PAGE_SIZE)break;
      cursor=snap.docs.at(-1).id;
      assert.ok(pages<=Math.ceil(RECORDS/PAGE_SIZE)+1,'Scan must terminate');
    }
    assert.equal(seen.size,RECORDS,'Read all active records, including the last page');
    assert.equal(pages,Math.ceil(RECORDS/PAGE_SIZE),'Expected page count');
    const row={pass,activeDocs:seen.size,queryPages:pages,elapsedMs:Math.round(performance.now()-start)};
    passes.push(row);
    console.log('PASS Firestore emulator active-Travel scan '+JSON.stringify(row));
  }
  assert.equal(passes[0].activeDocs+passes[1].activeDocs,2*RECORDS);
  console.log('BOUNDARY: test uses local Firestore emulator only; cloud billed reads, index-entry reads, p95/p99 latency, peak concurrency, write contention and provider throughput NOT measured.');
  console.log('RISK: a full scan every minute costs >= '+(RECORDS*1440).toLocaleString()+' returned-document reads/day at this steady active-Travel population, excluding other operations.');
}
main().catch(e=>{console.error(e);process.exitCode=1;}).finally(()=>db.terminate());
