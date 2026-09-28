const assert=require('node:assert/strict');
const { transitFareFor, revalidateTransit }=require('./smart');

const regionA={transit:{feeds:[
  {feedId:'A',agency:'Metro Alpha',fareCents:275,freeModes:[],transferIncluded:true},
  {feedId:'ARAIL',agency:'Alpha Rail',fareCents:null,freeModes:[]},
]}};
const regionB={transit:{feeds:[
  {feedId:'B',agency:'Transit Beta',fareCents:190,freeModes:['tram']},
]}};
const leg=(id,agency,mode='bus')=>({kind:'transit',mode,route:{gtfsId:id,agency},from:{stopId:'S1'},to:{stopId:'S2'}});
assert.equal(transitFareFor(leg('A:10','Metro Alpha'),regionA),275,'fare comes from selected region/feed, not Miami constants');
assert.equal(transitFareFor(leg('B:22','Transit Beta'),regionB),190,'a structurally different market uses its own fare');
assert.equal(transitFareFor(leg('B:FREE','Transit Beta','tram'),regionB),0,'free mode is feed configuration');
assert.equal(transitFareFor(leg('ARAIL:R','Alpha Rail','rail'),regionA),null,'unknown/variable agency fare remains unknown');
assert.equal(require('./smart').fareGroupsFor(regionA)[0].transferIncluded,true,'transfer inclusion is explicit feed data');
assert.equal(require('./smart').fareGroupsFor(regionB)[0].transferIncluded,false,'another market never inherits the home market transfer rule');

const current={from:{name:'Board',lat:40,lng:-74},to:{name:'Alight',lat:40.1,lng:-74.1},legs:[leg('A:10','Metro Alpha')]};
const itinerary=(route='A:10')=>({startTime:'2026-09-26T12:00:00Z',endTime:'2026-09-26T12:20:00Z',durationSec:1200,legs:[{...leg(route,'Metro Alpha'),startTime:'2026-09-26T12:00:00Z',endTime:'2026-09-26T12:20:00Z',from:{name:'Board',lat:40,lng:-74,stopId:'S1'},to:{name:'Alight',lat:40.1,lng:-74.1,stopId:'S2'}}]});

(async()=>{
  let r=await revalidateTransit(current,{when:new Date('2026-09-26T11:55:00Z'),planTransit:async()=>({status:'ok',itineraries:[itinerary()]})});
  assert.equal(r.status,'ok');assert.equal(r.changed,false,'same current service permits continuation');

  r=await revalidateTransit(current,{planTransit:async()=>({status:'ok',itineraries:[itinerary('A:99')]})});
  assert.equal(r.status,'ok');assert.equal(r.changed,true,'reroute/change must hold stale continuation');

  r=await revalidateTransit(current,{planTransit:async()=>({status:'none',reason:'cancelled'})});
  assert.equal(r.status,'none','cancelled/no-current-service must fail closed');

  r=await revalidateTransit(current,{planTransit:async()=>({status:'unavailable',reason:'realtime_down'})});
  assert.equal(r.status,'unavailable','planner/realtime outage must not bless old itinerary');

  const screen=require('node:fs').readFileSync(require('node:path').join(__dirname,'..','app','smart.tsx'),'utf8');
  assert.ok(screen.includes("revalidation?.status === 'ok' && !revalidation.changed"),'second car Travel requires current transit verification');
  assert.ok(!screen.includes('allMdt'),'Smart Travel UI must not branch on Miami-Dade identity');
  console.log('all multi-market Smart Travel capability/revalidation tests passed');
})().catch(e=>{console.error(e);process.exit(1)});
