import fs from 'node:fs';
import { spawnSync } from 'node:child_process';

const routeFiles = fs.readdirSync('app',{recursive:true}).filter(p=>/\.(tsx|ts)$/.test(p)).map(p=>'app/'+p.replaceAll('\\','/')).sort();
const server = fs.readFileSync('backend/server.js','utf8');
const endpoints=[...server.matchAll(/(?:app|router)\.(get|post|put|patch|delete)\(\s*['"`]([^'"`]+)/g)].map(m=>m[1].toUpperCase()+' '+m[2]).sort();

const suites=[
 'accountauth','auth','authconfiguration','accountclosure','securityintegrity','abuse',
 'markets','market','jurisdiction','documents','qualification','screening','adverse','disclosure','insurance-monitoring','operatorfees',
 'gate','dispatchgate','dispatchfailure','acceptance','travelparty','travelprogress','travelmoney','faremodel','economics','payments','idempotency','settle','refundexposure','remittance','paidwith','paymentarchitecture',
 'sched','scheduledparty','schedulerlease','smart','smartauthority','smartcontinuity','smartfallback','smartmultimarket','smarttravel','transit','tolls',
 'familyage','lostitem','support','operatorsupport','voice','providerqueue','providerqueue.durability','launchfailure','launchinvariants','releaseinvariants'
].map(n=>'backend/'+n+'.test.js');

const routeDispositions = Object.fromEntries(routeFiles.map(r=>[r,
 r==='app/_layout.tsx'?'shell/navigation root':
 r.includes('operator/')?'Operator journey/control surface':
 r.includes('pickup-map')?'Traveler pickup-map platform implementation':
 r==='app/drive.tsx'?'Operator entry/economics surface':
 'Traveler/account/support surface'
]));

const endpointDispositions = Object.fromEntries(endpoints.map(e=>[e,
 e.includes('/operator/')||e.includes('/connect/')?'Operator authority/API':
 e.includes('/travel/')||e.includes('/quote')||e.includes('/route')||e.includes('/fare')||e.includes('/payment')||e.includes('/smart')?'Traveler/Travel/payment authority/API':
 e.includes('/family')||e.includes('/lost-item')||e.includes('/emergency')||e.includes('/support')?'Traveler safety/support API':
 e.includes('/stripe/')?'Provider webhook authority':
 'platform/configuration API'
]));

const attacks=[
 'unauthenticated request','wrong-role request','missing qualification','unsupported jurisdiction','expired/invalid insurance state','screening not authoritative',
 'missing disclosure acknowledgement','payout not ready','offline Operator','stale assignment','duplicate accept','wrong Operator','wrong Traveler','illegal state reorder',
 'duplicate progress','client-forged fare','client-forged toll','client-forged payment amount','duplicate PaymentIntent','duplicate settlement','provider timeout',
 'provider duplicate event','provider event after process restart','network loss after authoritative write','client kill/restart','scheduled Travel race','Smart Travel stale continuation',
 'teen/guardian mismatch','lost-item wrong party','support cross-account access','account closure/re-auth boundary'
];

function runPass(pass){
 const cases=[];
 for(const file of suites){
   if(!fs.existsSync(file)){cases.push({file,result:'fail',reason:'missing suite'});continue;}
   const r=spawnSync(process.execPath,[file],{encoding:'utf8',env:process.env});
   cases.push({file,result:r.status===0?'pass':'fail',exitCode:r.status});
   process.stdout.write(`${r.status===0?'PASS':'FAIL'} P${pass} ${file}\n`);
   if(r.status!==0){process.stdout.write(r.stdout||'');process.stderr.write(r.stderr||'');}
 }
 return cases;
}

console.log(`Inventory: ${routeFiles.length} app route files; ${endpoints.length} server endpoints; ${suites.length} adversarial suites; ${attacks.length} attack classes.`);
const first=runPass(1);
const second=runPass(2);
const failed=[...first,...second].filter(x=>x.result!=='pass');
const report={
 schema:1,campaign:'double-whole-platform-adversarial-trace',candidate:process.env.GITHUB_SHA||null,
 inventory:{routeFiles,routeDispositions,endpoints,endpointDispositions,attackClasses:attacks},
 fictionalActors:{
   operator:'Elena Marquez — fictional Operator used as the lifecycle persona; no real identity.',
   traveler:'Alex Morgan — fictional Traveler used as the lifecycle persona; no real identity.'
 },
 passes:[
   {pass:1,purpose:'cold-state whole-platform adversarial trace',cases:first},
   {pass:2,purpose:'repeat trace to expose state leakage, non-idempotence and restart assumptions',cases:second}
 ],
 evidenceBoundary:{
   establishes:'deterministic source-level/API/state-machine/accounting/provider-failure behavior represented by the included suites and complete route/endpoint disposition inventory',
   doesNotEstablish:'physical-device rendering, native OS behavior, production-provider acceptance or live-money settlement'
 },
 result:failed.length?'fail':'pass'
};
fs.mkdirSync('artifacts/commissioning',{recursive:true});
fs.writeFileSync('artifacts/commissioning/double-whole-platform-adversarial-trace.json',JSON.stringify(report,null,2)+'\n');
console.log(`\nRESULT: ${report.result.toUpperCase()} — ${first.length+second.length-failed.length}/${first.length+second.length} suite executions passed`);
if(failed.length)process.exit(1);
