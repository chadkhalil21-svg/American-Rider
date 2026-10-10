'use strict';
// Founder-operated, provider-neutral screening case triage.
// Advisory follow-ups are private work cues, NEVER a CRA turnaround promise,
// legal deadline, report receipt or qualification authority.
const FIRST_REVIEW_MS = 48 * 60 * 60 * 1000;
const FOLLOW_UP_MS = 72 * 60 * 60 * 1000;
const STATES = Object.freeze({
  unclaimed: Object.freeze({
    owner: 'American Rider', action: 'Claim this case and verify the named reporting company independently.',
    waitingOn: 'Founder', interval: FIRST_REVIEW_MS,
  }),
  claimed: Object.freeze({
    owner: 'American Rider', action: 'Contact the original agency through independently verified business details. Confirm it can lawfully furnish the required report for American Rider, provider terms, cost, and a secure transfer method before asking for payment.',
    waitingOn: 'Founder', interval: FOLLOW_UP_MS,
  }),
  agency_contacted: Object.freeze({
    owner: 'Reporting agency', action: 'Follow up with the verified agency for a permitted, authenticated report. Do not treat ordinary email or an Operator-uploaded copy as verified evidence.',
    waitingOn: 'Agency response', interval: FOLLOW_UP_MS,
  }),
  report_authenticated: Object.freeze({
    owner: 'American Rider', action: 'Independently review the jurisdiction-specific screening requirements and the verified source report. Record CLEAR only when every requirement is satisfied; otherwise HOLD or begin the legally reviewed adverse process.',
    waitingOn: 'Founder decision', interval: FIRST_REVIEW_MS,
  }),
  dispute_open: Object.freeze({
    owner: 'Reporting agency', action: 'Obtain clarification and an independently authenticated corrected report. The disputed report cannot clear an Operator.',
    waitingOn: 'Corrected agency evidence', interval: FOLLOW_UP_MS,
  }),
  clarification_needed: Object.freeze({
    owner: 'Reporting agency', action: 'Recontact the verified agency to resolve the screening hold. Require fresh authenticated evidence before reconsideration.',
    waitingOn: 'Agency clarification', interval: FOLLOW_UP_MS,
  }),
  pre_adverse: Object.freeze({
    owner: 'American Rider', action: 'Follow the separately reviewed pre-adverse notice, report-copy, dispute and final-decision process. Never automatically refuse an Operator or presume notices were sent.',
    waitingOn: 'Founder legal review', interval: FIRST_REVIEW_MS,
  }),
  invalid: Object.freeze({
    owner: 'American Rider', action: 'Investigate missing or inconsistent screening case records. Do not adjudicate or approve.',
    waitingOn: 'Case repair', interval: FIRST_REVIEW_MS,
  }),
});
const validTime = (x) => Number.isSafeInteger(x) && x > 0;
function triageScreeningCase(screening, ticket, now = Date.now()) {
  const state = !ticket || ticket.status !== 'open' ? 'invalid'
    : screening?.decision === 'pre_adverse' ? 'pre_adverse'
    : ticket.screeningHandoff?.stage || 'unclaimed';
  const selected = STATES[state] || STATES.invalid;
  const last = validTime(ticket?.screeningHandoff?.updatedAt)
    ? ticket.screeningHandoff.updatedAt : validTime(ticket?.createdAt) ? ticket.createdAt : null;
  const followUpAt = last === null ? null : last + selected.interval;
  const followUpDue = followUpAt === null || followUpAt <= now;
  // No timer can grant clearance or move a case. Prioritize pending human/legal
  // review; unknown records are always urgent rather than silently hidden.
  const priority = state === 'invalid' || state === 'pre_adverse' ? 0
    : followUpDue ? 1 : state === 'unclaimed' || state === 'report_authenticated' ? 2 : 3;
  return Object.freeze({
    state, owner: selected.owner, nextAction: selected.action,
    waitingOn: selected.waitingOn, followUpAt, followUpDue, priority,
  });
}
function sortScreeningCases(rows, now = Date.now()) {
  return [...rows].sort((a, b) => {
    const ap = triageScreeningCase(a.screening, a.ticket, now);
    const bp = triageScreeningCase(b.screening, b.ticket, now);
    const aKey = ap.followUpAt ?? 0, bKey = bp.followUpAt ?? 0;
    return ap.priority - bp.priority || aKey - bKey ||
      String(a.screening?.transferCaseNo || '').localeCompare(String(b.screening?.transferCaseNo || ''));
  });
}
module.exports = { FIRST_REVIEW_MS, FOLLOW_UP_MS, triageScreeningCase, sortScreeningCases };
