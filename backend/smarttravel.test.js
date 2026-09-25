const assert = require('node:assert/strict');
const { quote } = require('./payments');
const { MIN_PLATFORM_CONTRIBUTION_CENTS } = require('./economics');

let n=0; const t=(name,fn)=>{try{fn();console.log('✓',name);n++;}catch(e){console.error('✗',name,e.message);process.exitCode=1;}};

for (const country of ['US','GB',null]) {
  for (const [a,b] of [[300,300],[1000,2000],[1794,2400],[5000,7500],[10000,15000]]) {
    t(`Smart Travel funds two contribution units ${country||'unknown'} ${a}+${b}`,()=>{
      const q1=quote(a,null,[],country,0);
      const q2=quote(b,{journeyNo:'AR-LEG1',leg1FareCents:a,leg1GovernmentFeeCents:0,leg1TollCents:0},[],country,0);
      assert.equal(q1.appFee+q2.appFee,q2._economics.platformGrossCents-q2._economics.commission);
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
