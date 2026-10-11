'use strict';
// Low-cost, privacy-preserving snapshot of background activity.
// These are logical-work counters, NOT billed Firestore reads/writes.
// Do not log ride/operator IDs, documents, coordinates, replies or names.
const KEYS = Object.freeze(['considered','scanned','watching','activeTravelsRead','written','lastWritten','overCapacity','pendingCount']);
function summarizeBackgroundWork(report) {
  const out = {};
  for (const [name, raw] of Object.entries(report || {})) {
    if (!/^[a-zA-Z][a-zA-Z0-9]*$/.test(name)) continue;
    const value = raw && typeof raw === 'object' ? raw : {};
    const item = {ok:value.ok === true, failed:value.ok === false};
    if (typeof value.skipped === 'string') item.skipped = value.skipped.slice(0,60);
    for (const key of KEYS) {
      if (key === 'overCapacity') {if(typeof value[key]==='boolean')item[key]=value[key];continue;}
      if (Number.isSafeInteger(value[key]) && value[key]>=0) item[key]=value[key];
    }
    out[name]=item;
  }
  return out;
}
function createBackgroundReporter({intervalMs=60*60_000,emit=console.info,now=Date.now}={}) {
  if (!Number.isFinite(intervalMs)||intervalMs<60_000)throw new Error('Invalid telemetry interval');
  let last = 0;
  return report => {
    const at=now();
    if (last && at-last<intervalMs)return false;
    last=at;
    emit('[workload] background_summary',JSON.stringify(summarizeBackgroundWork(report)));
    return true;
  };
}
module.exports = {summarizeBackgroundWork,createBackgroundReporter};
