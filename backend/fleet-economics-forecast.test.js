'use strict';
const assert=require('node:assert/strict');
const {computeOperatorFleetEconomics: forecast}=require('./fleet-economics-forecast');
const expected={
  50:{travels:3000,remainder:1821,expense:6249},
  100:{travels:6000,remainder:5268,expense:10872},
  200:{travels:12000,remainder:12065,expense:20215},
  500:{travels:30000,remainder:32612,expense:48088},
  1000:{travels:60000,remainder:66728,expense:94672},
};
for(const [label,row] of Object.entries(expected)){
  const n=Number(label),r=forecast(n);
  assert.equal(r.activeOperators,n*.60);
  assert.equal(r.travelsMonthly,row.travels,'travel forecasts must derive from utilization, not registrations');
  assert(Math.abs(r.remainderUsd-row.remainder)<1,'monthly modeled remainder: '+n);
  assert(Math.abs(r.totalExpenseUsd-row.expense)<1,'monthly modeled full expense budget: '+n);
  assert(Math.abs(r.totalExpenseUsd-r.grossRevenueUsd+r.remainderUsd)<1e-6);
  assert.equal(r.expenses.connectActiveUsd,r.accountFeeCollectedUsd,
    'only actually recovered account fees can be netted against billed active accounts');
  assert(r.expenses.reservedRiskUsd===r.travelsMonthly*.25);
  assert(r.expenses.paidMapsUsd>=20,'commercial map fallback is budgeted');
  assert(r.expenses.emailUsd>=20,'provider daily limits are not mistaken for commercial plan');
}
const weak=forecast(50,{activeFraction:.20,travelsPerActiveDay:2});
assert.equal(weak.travelsMonthly,400);
assert(weak.remainderUsd<-1300 && !weak.breakEven,'fixed expenses cause losses even with registered Operators');
const zero=forecast(50,{activeFraction:0});
assert(zero.remainderUsd<0&&!zero.breakEven&&zero.remainderPerTravelUsd===null,'no guaranteed profit without completed Travels');
const insuranceStress=forecast(50,{corporateBaseUsd:5000});
assert(insuranceStress.remainderUsd<0,'company-level insurance/regulatory obligations can reverse a positive estimate');
const collectionsFail=forecast(100,{collectionFraction:0});
assert.equal(collectionsFail.accountFeeCollectedUsd,0);
assert(Math.abs(forecast(100).remainderUsd-collectionsFail.remainderUsd-120)<1e-6,
  'active Stripe account fees are paid whether or not recoveries succeed');
const moreRides=forecast(100,{travelsPerActiveDay:8});
assert(moreRides.travelsMonthly===9600 && moreRides.expenses.cardUsd>forecast(100).expenses.cardUsd);
assert.throws(()=>forecast(75),/paid capacity tier/);
assert.throws(()=>forecast(50,{activeFraction:1.2}),/fractions/);
assert.throws(()=>forecast(50,{corporateBaseUsd:-100}),/nonnegative/);
console.log('PASS 50/100/200/500/1000 cohort model, no-ride loss, idle utilization stress, $2 account fee collections, maps/Firestore/email/vendor accounting, demand increase, missing capacity tier and corporate insurance stress');
