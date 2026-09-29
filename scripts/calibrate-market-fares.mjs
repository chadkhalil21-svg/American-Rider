// Reusable market-fare calibration. Analysis only; never changes production rates.
// Usage: node scripts/calibrate-market-fares.mjs data/miami-fare-calibration.json
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
const require=createRequire(import.meta.url);
const { minimumPlatformFeeCents }=require('../backend/economics.js');
const input=process.argv[2];
if(!input) throw new Error('usage: calibrate-market-fares <market-evidence.json>');
const basket=JSON.parse(fs.readFileSync(path.resolve(input),'utf8'));
if(!Array.isArray(basket.observations)||basket.observations.length<3) throw new Error('market evidence requires observations');
const rows=basket.observations.filter(r=>!r[5]);
function solve3(A,b){const m=A.map((r,i)=>[...r,b[i]]);for(let c=0;c<3;c++){let p=c;for(let r=c+1;r<3;r++)if(Math.abs(m[r][c])>Math.abs(m[p][c]))p=r;[m[c],m[p]]=[m[p],m[c]];const d=m[c][c];if(Math.abs(d)<1e-12)throw new Error('singular calibration matrix');for(let j=c;j<4;j++)m[c][j]/=d;for(let r=0;r<3;r++)if(r!==c){const f=m[r][c];for(let j=c;j<4;j++)m[r][j]-=f*m[c][j];}}return m.map(r=>r[3]);}
function ols(samples,y){const X=samples.map(r=>[1,r[1],r[2]]),xtx=Array.from({length:3},()=>Array(3).fill(0)),xty=Array(3).fill(0);for(let i=0;i<X.length;i++)for(let a=0;a<3;a++){xty[a]+=X[i][a]*y[i];for(let b=0;b<3;b++)xtx[a][b]+=X[i][a]*X[i][b];}return solve3(xtx,xty);}
function fareForTargetTotal(totalCents){for(let fare=totalCents;fare>=0;fare--){const fee=minimumPlatformFeeCents({travelCostCents:fare,cardCountry:'US'});if(fare+fee<=totalCents)return{fare,fee,total:fare+fee};}throw new Error('no feasible fare');}
const fraction=Number(basket.targetFraction);
if(!(fraction>0&&fraction<=1)) throw new Error('targetFraction must be in (0,1]');
const market=ols(rows,rows.map(r=>r[3]));
const targetTotals=rows.map(r=>Math.round(r[3]*fraction*100));
const reverse=targetTotals.map(fareForTargetTotal);
const fare=ols(rows,reverse.map(x=>x.fare/100));
const fmt=x=>Number(x).toFixed(3);
console.log('Market:',basket.market||input);
console.log('Ordinary observations:',rows.length);
console.log('Observed market-total OLS: $'+fmt(market[0])+' + $'+fmt(market[1])+'/mile + $'+fmt(market[2])+'/minute');
console.log('Planning target:',(fraction*100).toFixed(1)+'% of robust evidence input');
console.log('Diagnostic Fare fit: $'+fmt(fare[0])+' + $'+fmt(fare[1])+'/mile + $'+fmt(fare[2])+'/minute');
console.log('HOLD: diagnostic coefficients are not production authority. Promotion requires evidence, router, economics and hold-out gates.');
