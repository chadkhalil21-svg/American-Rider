// Reproducible Miami fare calibration. Analysis only: this script never changes production rates.
import fs from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { minimumPlatformFeeCents } = require('../backend/economics.js');
const basket = JSON.parse(fs.readFileSync(new URL('../data/miami-fare-calibration.json', import.meta.url)));
const rows = basket.observations.filter((r) => !r[5]);

function solve3(A,b) {
  const m=A.map((r,i)=>[...r,b[i]]);
  for(let c=0;c<3;c++){
    let p=c; for(let r=c+1;r<3;r++) if(Math.abs(m[r][c])>Math.abs(m[p][c])) p=r;
    [m[c],m[p]]=[m[p],m[c]];
    const d=m[c][c]; if(Math.abs(d)<1e-12) throw new Error('singular calibration matrix');
    for(let j=c;j<4;j++) m[c][j]/=d;
    for(let r=0;r<3;r++) if(r!==c){ const f=m[r][c]; for(let j=c;j<4;j++) m[r][j]-=f*m[c][j]; }
  }
  return m.map(r=>r[3]);
}
function ols(samples, y) {
  const X=samples.map(r=>[1,r[1],r[2]]);
  const xtx=Array.from({length:3},()=>Array(3).fill(0)), xty=Array(3).fill(0);
  for(let i=0;i<X.length;i++) for(let a=0;a<3;a++){
    xty[a]+=X[i][a]*y[i];
    for(let b=0;b<3;b++) xtx[a][b]+=X[i][a]*X[i][b];
  }
  return solve3(xtx,xty);
}
function fareForTargetTotal(totalCents) {
  for(let fare=totalCents;fare>=0;fare--){
    const fee=minimumPlatformFeeCents({travelCostCents:fare,cardCountry:'US'});
    if(fare+fee<=totalCents) return {fare,fee,total:fare+fee};
  }
  throw new Error('no feasible fare');
}
const marketY=rows.map(r=>r[3]);
const market=ols(rows,marketY);
const targetTotals=rows.map(r=>Math.round(r[3]*basket.targetFraction*100));
const reverse=targetTotals.map(fareForTargetTotal);
const fare=ols(rows,reverse.map(x=>x.fare/100));
const current=(m,t)=>1+0.85*m+0.15*t;
const candidate=(m,t)=>fare[0]+fare[1]*m+fare[2]*t;
const fmt=x=>Number(x).toFixed(3);

console.log('Miami ordinary-market observations:', rows.length);
console.log('Observed market-total OLS: $'+fmt(market[0])+' + $'+fmt(market[1])+'/mile + $'+fmt(market[2])+'/minute');
console.log('Target position:', (basket.targetFraction*100).toFixed(1)+'% of observed route-average Total');
console.log('Candidate Travel Fare OLS: $'+fmt(fare[0])+' + $'+fmt(fare[1])+'/mile + $'+fmt(fare[2])+'/minute');
console.log('');
console.log('route | market | 95% target | current AR fare | candidate fare | candidate total');
for(let i=0;i<rows.length;i++){
  const r=rows[i], cf=Math.round(candidate(r[1],r[2])*100);
  const fee=minimumPlatformFeeCents({travelCostCents:cf,cardCountry:'US'});
  console.log([r[0], '$'+r[3].toFixed(2), '$'+(targetTotals[i]/100).toFixed(2),
    '$'+current(r[1],r[2]).toFixed(2), '$'+(cf/100).toFixed(2), '$'+((cf+fee)/100).toFixed(2)].join(' | '));
}
console.log('');
console.log('HOLD: candidate coefficients are evidence, not production authority.');
console.log('Promote only after independent/multi-platform quote sampling, short-trip coverage, routed Miami validation, and economic tests.');
