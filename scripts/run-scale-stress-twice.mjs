import {spawnSync} from 'node:child_process';
import fs from 'node:fs';
const passes=[];
for(let pass=1;pass<=2;pass++){
 const r=spawnSync(process.execPath,['backend/scale.test.js'],{encoding:'utf8',env:process.env});
 process.stdout.write('\n=== SCALE PASS '+pass+' ===\n'+(r.stdout||''));
 process.stderr.write(r.stderr||'');
 passes.push({pass,exitCode:r.status,ok:r.status===0,output:(r.stdout||'').slice(-12000)});
}
const report={schema:1,campaign:'scale-stress-twice',candidate:process.env.GITHUB_SHA||null,
 scenarios:['quote/economics 1M workload','matching CPU 1K/10K/50K candidates','Firestore dispatch read amplification 10K/100K/1M Travels','repeat pass for deterministic consistency'],
 evidenceBoundary:{establishes:'source architecture and deterministic CPU/economics scale behavior',doesNotEstablish:'deployed Firestore/OSRM/HERE/Stripe throughput, network latency, provider quotas or physical-device performance'},
 passes,result:passes.every(x=>x.ok)?'pass':'fail'};
fs.mkdirSync('artifacts/scale',{recursive:true});fs.writeFileSync('artifacts/scale/scale-stress-twice.json',JSON.stringify(report,null,2)+'\n');
console.log('\nSCALE RESULT: '+report.result.toUpperCase());
process.exit(report.result==='pass'?0:1);
