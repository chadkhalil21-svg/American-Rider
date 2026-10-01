// Reusable market-fare calibration and promotion audit.
// Usage: node scripts/calibrate-market-fares.mjs <market-evidence.json>
// Legacy array baskets remain supported. Object baskets may mark fit/holdout rows and sources.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
const require=createRequire(import.meta.url);
const { minimumPlatformFeeCents }=require('../backend/economics.js');
const input=process.argv[2];
if(!input) throw new Error('usage: calibrate-market-fares <market-evidence.json>');
const basket=JSON.parse(fs.readFileSync(path.resolve(input),'utf8'));
if(!Array.isArray(basket.observations)||basket.observations.length<3) throw new Error('market evidence requires observations');

function norm(r){
  if(Array.isArray(r)) return {route:r[0],miles:Number(r[1]),minutes:Number(r[2]),total:Number(r[3]),source:r[4],airport:!!r[5],role:'fit',product:'unspecified'};
  return {route:r.route,miles:Number(r.miles),minutes:Number(r.minutes),total:Number(r.observedTravelerTotalUsd),source:r.source,airport:!!r.airportOrigin,role:r.role||'fit',product:r.product||'unspecified'};
}
const all=basket.observations.map(norm);
const fit=all.filter(r=>!r.airport&&r.role==='fit');
const holdout=all.filter(r=>!r.airport&&r.role==='holdout');
if(fit.length<3) throw new Error('market evidence requires at least 3 ordinary fit observations');
function solve3(A,b){const m=A.map((r,i)=>[...r,b[i]]);for(let c=0;c<3;c++){let p=c;for(let r=c+1;r<3;r++)if(Math.abs(m[r][c])>Math.abs(m[p][c]))p=r;[m[c],m[p]]=[m[p],m[c]];const d=m[c][c];if(Math.abs(d)<1e-12)throw new Error('singular calibration matrix');for(let j=c;j<4;j++)m[c][j]/=d;for(let r=0;r<3;r++)if(r!==c){const f=m[r][c];for(let j=c;j<4;j++)m[r][j]-=f*m[c][j];}}return m.map(r=>r[3]);}
function ols(rows,y){const X=rows.map(r=>[1,r.miles,r.minutes]),xtx=Array.from({length:3},()=>Array(3).fill(0)),xty=Array(3).fill(0);for(let i=0;i<X.length;i++)for(let a=0;a<3;a++){xty[a]+=X[i][a]*y[i];for(let b=0;b<3;b++)xtx[a][b]+=X[i][a]*X[i][b];}return solve3(xtx,xty);}
function fareForTargetTotal(totalCents){for(let fare=totalCents;fare>=0;fare--){const fee=minimumPlatformFeeCents({travelCostCents:fare,cardCountry:'US'});if(fare+fee<=totalCents)return fare;}throw new Error('no feasible fare');}
const fraction=Number(basket.targetFraction);
if(!(fraction>0&&fraction<=1)) throw new Error('targetFraction must be in (0,1]');
const target=fit.map(r=>Math.round(r.total*fraction*100));
const fares=target.map(fareForTargetTotal);
const coef=ols(fit,fares.map(x=>x/100));
const totalFor=(r)=>{const fare=Math.max(0,Math.round((coef[0]+coef[1]*r.miles+coef[2]*r.minutes)*100));return (fare+minimumPlatformFeeCents({travelCostCents:fare,cardCountry:'US'}))/100;};
const errors=holdout.map(r=>({route:r.route,actual:r.total,predicted:totalFor(r),ape:Math.abs(totalFor(r)-r.total)/r.total}));
const mape=errors.length?errors.reduce((s,r)=>s+r.ape,0)/errors.length:null;
const domains=new Set(all.map(r=>{try{return new URL(r.source).hostname.replace(/^www\./,'')}catch{return String(r.source||'')}}).filter(Boolean));
const products=new Set(fit.map(r=>r.product));
const sensible=coef.every(Number.isFinite)&&coef[0]>=0&&coef[1]>=0&&coef[2]>=0;
const gates={
  enoughFit:fit.length>=8,
  hasHoldout:holdout.length>=3,
  sourceDiversity:domains.size>=2,
  productSpecific:[...products].every(p=>p!=='unspecified'),
  nonnegativeCoefficients:sensible,
  holdoutMape:mape!=null&&mape<=0.15,
  routerValidated:basket.productionRouterValidated===true,
  economicsValidated:basket.economicsValidated===true,
};
const promotable=Object.values(gates).every(Boolean);
const fmt=x=>Number(x).toFixed(3);
console.log('Market:',basket.market||input);
console.log('Fit / holdout:',fit.length,'/',holdout.length);
console.log('Sources:',[...domains].join(', '));
console.log('Diagnostic Fare fit: $'+fmt(coef[0])+' + $'+fmt(coef[1])+'/mile + $'+fmt(coef[2])+'/minute');
if(errors.length) console.log('Holdout MAPE:',(mape*100).toFixed(1)+'%');
console.log('Promotion gates:',JSON.stringify(gates));
console.log(promotable?'PROMOTABLE: evidence gates passed. Production still requires an explicit reviewed pricing-record change.':'HOLD: one or more promotion gates failed; production pricing must not change.');
