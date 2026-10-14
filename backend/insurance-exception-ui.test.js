'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {recordOperatorInsuranceRisk}=require('./insurance-adverse-report');
const {continuingStatus}=require('./insurance-monitoring');
const ui=fs.readFileSync(path.join(__dirname,'../app/operator/insurance.tsx'),'utf8');
const nav=fs.readFileSync(path.join(__dirname,'../src/components/operator.tsx'),'utf8');
const sources=['en','es','fr','de','it'].map(lang=>fs.readFileSync(path.join(__dirname,'../src/i18n/'+lang+'.ts'),'utf8'));
const NOW=Date.UTC(2026,9,14,12);
for(let pass=1;pass<=2;pass++){
  assert.match(ui,/\[showRiskOptions, setShowRiskOptions\] = useState\(false\)/,
    'exception reporting must be closed by default, not a permanent warning');
  assert.match(ui,/accessibilityState=\{\{ expanded: showRiskOptions \}\}/,
    'disclose collapsed/expanded state accessibly');
  assert.match(ui,/\{showRiskOptions && <>[\s\S]*?reportRisk\('pending_cancellation'\)[\s\S]*?reportRisk\('cancelled'\)/,
    'both safety controls remain within deliberate opt-in reveal');
  assert.match(ui,/reportInsuranceRisk\(kind\)/,
    'opt-in action uses the authenticated server-side stop');
  assert.match(nav,/label: 'Insurance', onPress:[^\n]*\/operator\/insurance/,
    'Operator drawer preserves a permanent route in and out of service');
  for(const s of sources)assert.match(s,/insRiskEntry: /,'each language exposes the new entry label');
  assert.equal(/useEffect\([\s\S]{0,160}reportRisk\(/.test(ui),false,
    'no auto-report or daily prompt on startup');
  const valid={
    status:'verified_active',lastVerifiedAt:NOW-3600000,
    expirationDate:'2027-01-01',effectiveDate:'2026-01-01',policyNumber:'TEST-001'
  };
  assert.equal(continuingStatus({insuranceMonitoring:valid},NOW).ok,true);
  const risk=recordOperatorInsuranceRisk(valid,'pending_cancellation',NOW);
  const state=continuingStatus({insuranceMonitoring:risk},NOW);
  assert.equal(state.ok,false,'no new Travel after Operator notice');
  assert.match(state.reason,/pending cancellation was reported/i);
  assert.doesNotMatch(state.reason,/insurer or broker has reported/i,
    'Operator report must not be falsely attributed to a licensed third party');
}
console.log('PASS twice: contextual insurance exception disclosure, five languages, drawer reachability and honest source wording');
