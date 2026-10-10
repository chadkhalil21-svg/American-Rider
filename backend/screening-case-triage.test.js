'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { FIRST_REVIEW_MS, FOLLOW_UP_MS, triageScreeningCase, sortScreeningCases } = require('./screening-case-triage');
const NOW = Date.parse('2026-10-10T16:00:00Z');
const mk = (stage, createdAt = NOW - 1000, updatedAt) => ({
  screening: { decision: 'awaiting_agency', transferCaseNo: 'AR-C-100' },
  ticket: { status: 'open', createdAt,
    screeningHandoff: stage ? { stage, ...(updatedAt == null ? {} : { updatedAt }) } : {} },
});
const triage = row => triageScreeningCase(row.screening, row.ticket, NOW);
assert.equal(FIRST_REVIEW_MS, 48 * 3600000);
assert.equal(FOLLOW_UP_MS, 72 * 3600000);
assert.equal(triage(mk(null)).state, 'unclaimed');
assert.equal(triage(mk(null)).waitingOn, 'Founder');
assert.equal(triage(mk(null)).followUpDue, false);
assert.equal(triage(mk(null, NOW - FIRST_REVIEW_MS - 1)).followUpDue, true);
assert.equal(triage(mk('claimed', NOW - 1, NOW - 100)).owner, 'American Rider');
assert.equal(triage(mk('agency_contacted', NOW - 1, NOW - FOLLOW_UP_MS - 1)).waitingOn, 'Agency response');
assert.equal(triage(mk('agency_contacted', NOW - 1, NOW - FOLLOW_UP_MS - 1)).followUpDue, true);
assert.equal(triage(mk('agency_contacted', NOW - 1, NOW - 1000)).followUpDue, false);
assert.equal(triage(mk('report_authenticated')).waitingOn, 'Founder decision');
assert.match(triage(mk('report_authenticated')).nextAction, /CLEAR only when every requirement/);
assert.equal(triage(mk('dispute_open')).waitingOn, 'Corrected agency evidence');
assert.match(triage(mk('dispute_open')).nextAction, /cannot clear/);
assert.equal(triage(mk('clarification_needed')).waitingOn, 'Agency clarification');
assert.equal(triage({screening:{decision:'pre_adverse'},ticket:mk('agency_contacted').ticket}).state, 'pre_adverse');
assert.equal(triage({screening:{decision:'pre_adverse'},ticket:mk('agency_contacted').ticket}).priority, 0);
assert.equal(triage({screening:{decision:'pass'},ticket:null}).state, 'invalid');
assert.equal(triage({screening:{decision:'review'},ticket:{status:'closed'}}).state, 'invalid');
assert.equal(triage({screening:{decision:'review'},ticket:{status:'open'}}).followUpDue,true);
assert.equal(triage({screening:{decision:'review'},ticket:{status:'open'}}).followUpAt,null);
assert.equal(triage(mk('unknown')).state, 'unknown');
assert.match(triage(mk('unknown')).nextAction,/Investigate/);
const rows = [
  {...mk('agency_contacted', NOW - 1, NOW - 1), screening:{transferCaseNo:'AR-C-Z'}},
  {...mk(null, NOW - FIRST_REVIEW_MS - 1), screening:{transferCaseNo:'AR-C-A'}},
  {...mk('report_authenticated', NOW - 1, NOW - 1), screening:{transferCaseNo:'AR-C-B'}},
  {screening:{decision:'pre_adverse',transferCaseNo:'AR-C-Y'},ticket:{status:'open',createdAt:NOW - 1}},
];
const ordered = sortScreeningCases(rows, NOW).map(r=>r.screening.transferCaseNo);
assert.deepEqual(ordered,['AR-C-Y','AR-C-A','AR-C-B','AR-C-Z']);
assert.equal(rows[0].screening.transferCaseNo,'AR-C-Z','sorting cannot mutate input');
// The new console is presentation-only; no background screening or travel gate changes.
const ops = fs.readFileSync(path.join(__dirname,'ops.js'),'utf8');
assert.match(ops,/sortScreeningCases\(candidates\.map/);
assert.match(ops,/triageScreeningCase\(r, linked\)/);
assert.match(ops,/Next action:<\/strong>/);
assert.match(ops,/suggested staff checkpoint, not a promised provider response or legal deadline/);
assert.match(ops,/opsAuthMode\(\) !== 'named'/);
assert.doesNotMatch(fs.readFileSync(path.join(__dirname,'screening-case-triage.js'),'utf8'),
  /require\(['"]\.\/firebase-admin['"]\)/, 'triage cannot write state');
console.log('PASS screening triage: founder next step, internal follow-up, safe prioritization and no new legal authority');
