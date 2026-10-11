const { withinDeadline, OPS_BOARD_DEADLINE_MS } = require('./opslatency');
// The Founder's exception console never downloads all historic Travels just to render one page.
// A saturated sample is labelled as such; it is not a national count or financial ledger.
const LIMITS=Object.freeze({underway:75,recent:120,operators:75,scheduled:30,
  cases:50,pending:50,owed:50,disputed:50,attention:50,noReceipt:50});
const UNDERWAY=['assigned','accepted','arrived','onboard'];
async function loadOpsBoard(db,dayAgo) {
 if(!db)throw new Error('Firestore required for Operations board');
 const rides=db.collection('rides');
 // A missing production composite index must not make *every* Operations section disappear.
 // Preserve successful reads and explicitly mark unavailable sections; never present missing
 // emergency, payout or insurance-monitoring records as a clean/empty queue.
 const keys = Object.keys(LIMITS);
 const outcomes = await Promise.allSettled([
  withinDeadline(() => rides.where('status','in',UNDERWAY).limit(LIMITS.underway).get(), OPS_BOARD_DEADLINE_MS),
  withinDeadline(() => rides.where('createdAt','>',dayAgo).orderBy('createdAt','desc').limit(LIMITS.recent).get(), OPS_BOARD_DEADLINE_MS),
  withinDeadline(() => db.collection('operators').where('available','==',true).limit(LIMITS.operators).get(), OPS_BOARD_DEADLINE_MS),
  withinDeadline(() => db.collection('scheduled_rides').where('status','==','reserved').orderBy('atMs','asc').limit(LIMITS.scheduled).get(), OPS_BOARD_DEADLINE_MS),
  withinDeadline(() => db.collection('support_tickets').where('status','==','open').orderBy('createdAt','desc').limit(LIMITS.cases).get(), OPS_BOARD_DEADLINE_MS),
  withinDeadline(() => db.collection('users').where('qualification.status','in',['exception','refused','suspended']).limit(LIMITS.pending).get(), OPS_BOARD_DEADLINE_MS),
  withinDeadline(() => rides.where('payoutPending','==',true).limit(LIMITS.owed).get(), OPS_BOARD_DEADLINE_MS),
  withinDeadline(() => rides.where('disputed','==',true).limit(LIMITS.disputed).get(), OPS_BOARD_DEADLINE_MS),
  withinDeadline(() => rides.where('monitor.state','in',['emergency','escalated']).limit(LIMITS.attention).get(), OPS_BOARD_DEADLINE_MS),
  withinDeadline(() => rides.where('receiptFailed','==',true).limit(LIMITS.noReceipt).get(), OPS_BOARD_DEADLINE_MS),
 ]);
 return Object.fromEntries(keys.map((key, index) => {
  const result = outcomes[index];
  if (result.status === 'rejected') {
   const code = String(result.reason?.code ?? '');
   const timeout = code === 'OPS_STORAGE_TIMEOUT';
   const indexRequired = code === '9' || code === 'failed-precondition'
     || /requires an index/i.test(String(result.reason?.message ?? ''));
   // Do not expose Firestore links, document contents or customer information in logs.
   console.error(`[operations] Board section ${key} unavailable: ${indexRequired ? 'index_required' : timeout ? 'storage_timeout' : 'query_failed'}`);
   return [key, { rows: [], unavailable: true, reason: indexRequired ? 'index_required' : timeout ? 'storage_timeout' : 'query_failed',
     saturated: false, limit: LIMITS[key] }];
  }
  const snap = result.value;
  return [key, { rows: snap.docs.map((d) => ({ id: d.id, ...d.data() })),
   unavailable: false, saturated: snap.docs.length >= LIMITS[key], limit: LIMITS[key] }];
 }));
}
module.exports={LIMITS,UNDERWAY,loadOpsBoard};
