const assert=require('node:assert/strict');
const P=require('./market-pricing');
const A=require('./market-admission');
const R=require('./regions');
const F=require('./fares');

const fl=R.regionById('fl-southeast');
assert.ok(fl);
assert.deepEqual(P.pricingProblems(fl),[]);
assert.equal(A.regionReady(fl),true);
assert.equal(P.pricingForRegion('tx-austin'),null,'Texas cannot inherit Florida pricing');
assert.equal(P.pricingForRegion('ca-bay-area'),null,'California cannot inherit Florida pricing');

const fakeTexas={
  id:'tx-austin',
  jurisdiction:{state:'Texas',stateCode:'TX',tncStatute:'Tex. Occ. Code Ch. 2402',disclosureStatute:'review-required',screeningYears:1}
};
const txProblems=A.regionAdmissionProblems(fakeTexas);
assert.ok(txProblems.some(x=>x.includes('no explicit pricing record')));
assert.ok(txProblems.some(x=>x.includes('insurance requirements not configured')));

// A coordinate outside a configured/active market never receives South Florida coefficients.
assert.equal(F.fareCentsForCoords({lat:30.2672,lng:-97.7431},{lat:30.1975,lng:-97.6664}),null);

console.log('market admission/pricing fail-closed tests passed');
