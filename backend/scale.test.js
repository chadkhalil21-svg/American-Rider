// Scale architecture gate. This is intentionally a source+workload test, not a claim that CI
// emulates production Firestore/Stripe/OSRM. It prevents known O(N fleet) dispatch from being
// mistaken for scale readiness and exercises CPU/economic hot paths at representative sizes.
const fs=require('node:fs');
const {performance}=require('node:perf_hooks');
const {matchOperator}=require('./matching');
const {minimumPlatformFeeCents,economicsFor}=require('./economics');
const server=fs.readFileSync(__dirname+'/server.js','utf8');

const results=[];
const check=(name,ok,detail)=>results.push({name,ok:!!ok,detail});

check('dispatch does not query the entire available fleet',
  !/collection\('operators'\)\.where\('available',\s*'==',\s*true\)\.get\(\)/.test(server),
  'Current implementation performs an unbounded available-Operator query per dispatch. Replace with bounded geo-indexed candidate retrieval.');

function fleet(n,now){
 const a=new Array(n);
 for(let i=0;i<n;i++){
   const angle=(i*2.399963229728653), radius=Math.sqrt(i+1)*0.00008;
   a[i]={id:'o'+i,available:true,onlineAt:now,screeningCheckedAt:now,
    disclosureVersion:require('./disclosure').DISCLOSURE_VERSION,commissioned:true,
    lat:25.7617+Math.sin(angle)*radius,lng:-80.1918+Math.cos(angle)*radius,classes:['Standard']};
 }
 return a;
}
for(const n of [1000,10000,50000]){
 const now=Date.now(), ops=fleet(n,now), t=performance.now();
 const best=matchOperator(ops,{lat:25.7617,lng:-80.1918},'Standard',{requireScreening:true,now});
 const ms=performance.now()-t;
 check('matching CPU '+n+' candidates',!!best&&Number.isFinite(ms),ms.toFixed(2)+' ms; architecture must bound candidate count before this function');
}

// 1,000,000-Travel economic workload: exact integer solver must preserve the invariant.
let econBad=0; let checksum=0; const et=performance.now();
for(let i=0;i<1_000_000;i++){
 const fare=500+(i%15001), gov=i%97===0?200:0, toll=i%53===0?375:0;
 const fee=minimumPlatformFeeCents({travelCostCents:fare,governmentFeeCents:gov,tollCents:toll,cardCountry:i%20?'US':'CA'});
 const e=economicsFor({travelCostCents:fare,platformFeeCents:fee,governmentFeeCents:gov,tollCents:toll,cardCountry:i%20?'US':'CA'});
 if(e.platformContributionCents<e.requiredContributionCents)econBad++;
 checksum=(checksum+fee)%1000000007;
}
check('1M Travel economics invariant',econBad===0,((performance.now()-et)/1000).toFixed(2)+' s; checksum '+checksum);

// Read-amplification scenarios for the CURRENT unbounded dispatch query.
for(const [ops,travels] of [[1000,10000],[10000,100000],[50000,1000000]]){
 const reads=BigInt(ops)*BigInt(travels);
 check('Firestore dispatch read amplification '+ops+'x'+travels,false,
  reads.toLocaleString()+' potential document reads under current unbounded available-fleet query');
}

let bad=0;for(const r of results){if(!r.ok)bad++;console.log((r.ok?'PASS':'FAIL')+'  '+r.name+' — '+r.detail);}
console.log('\n'+(results.length-bad)+'/'+results.length+' scale checks passed');
process.exit(bad?1:0);
