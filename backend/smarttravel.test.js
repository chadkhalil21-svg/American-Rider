const assert = require('node:assert/strict');
const { quote } = require('./payments');
const { smartQuote } = require('./smart');
const { MIN_PLATFORM_CONTRIBUTION_CENTS } = require('./economics');

let n=0; const t=(name,fn)=>{try{fn();console.log('✓',name);n++;}catch(e){console.error('✗',name,e.message);process.exitCode=1;}};

for (const country of ['US','GB',null]) {
  for (const [a,b] of [[300,300],[1000,2000],[1794,2400],[5000,7500],[10000,15000]]) {
    t(`Smart Travel funds two contribution units ${country||'unknown'} ${a}+${b}`,()=>{
      const q1=quote(a,null,[],country,0);
      const q2=quote(b,{journeyNo:'AR-LEG1',leg1FareCents:a,leg1GovernmentFeeCents:0,leg1TollCents:0},[],country,0);
      const combinedCommission=Math.floor((a+b)*.01);
      assert.equal(q1.appFee+q2.appFee,q2._economics.platformGrossCents-combinedCommission);
      assert.ok(q2._economics.platformContributionCents >= 2*MIN_PLATFORM_CONTRIBUTION_CENTS);
      assert.equal(q1.operatorGets, a-Math.floor(a*.01));
      assert.equal(q2.operatorGets, b-Math.floor(b*.01));
    });
  }
}
t('Smart Travel second leg never receives a negative incremental platform fee',()=>{
  const q=quote(300,{journeyNo:'x',leg1FareCents:50000},[],'US',0);
  assert.ok(q.appFee>=0);
});
console.log(`\n${n} Smart Travel economics tests passed`);

(async()=>{
  // Keep both ends beyond the walk threshold. This fixture verifies two charged car
  // Travels, so nearby coordinates that correctly become walk legs do not exercise it.
  const pickup={lat:25.7520,lng:-80.2100}, dest={lat:25.8150,lng:-80.3050};
  const stopA={name:'BRICKELL STAT.RAIL NORTHBOUND',lat:25.7639,lng:-80.1915,stopId:'A'};
  const stopB={name:'MIAMI INTERNATIONAL AIRPORT',lat:25.7950,lng:-80.2850,stopId:'B'};
  const when=new Date('2026-09-25T16:00:00Z');
  const planTransit=async()=>({status:'ok',itineraries:[{startTime:'2026-09-25T16:05:00Z',endTime:'2026-09-25T16:35:00Z',durationSec:1800,legs:[
    {kind:'car',mode:'car',from:{name:'Pickup',...pickup},to:stopA,durationSec:240,distanceMeters:1609},
    {kind:'transit',mode:'subway',from:stopA,to:stopB,startTime:'2026-09-25T16:05:00Z',endTime:'2026-09-25T16:35:00Z',durationSec:1800,distanceMeters:12000,stops:8,route:{gtfsId:'MDT:1',shortName:'',longName:'REGULAR METRORAIL SERVICE',agency:'Miami-Dade Transit'}},
    {kind:'car',mode:'car',from:stopB,to:{name:'Destination',...dest},durationSec:180,distanceMeters:1000},
  ]}]});
  const out=await smartQuote(pickup,dest,{planTransit,when});
  assert.equal(out.status,'ok');
  const cars=out.plan.legs.filter(l=>l.kind==='car');
  assert.equal(cars.length,2);
  const q1=quote(cars[0].cents,null,cars[0].feeLines||[],null,0);
  const q2=quote(cars[1].cents,{journeyNo:'preview',leg1FareCents:cars[0].cents,leg1GovernmentFeeCents:cars[0].governmentFeeCents||0,leg1TollCents:0},cars[1].feeLines||[],null,0);
  assert.equal(out.plan.smartCents,q1.travelerPays+q2.travelerPays,'Smart Travel preview must equal the two actual car-Travel charges');
  assert.equal(out.plan.feeCents,q1.appFee+q2.appFee);
  console.log('✓ Smart Travel preview equals its two real Travel charges');
})().catch(e=>{console.error(e);process.exitCode=1});
