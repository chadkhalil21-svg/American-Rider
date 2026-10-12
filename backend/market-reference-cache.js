'use strict';
// Bounded, single-flight market-reference reads. No scheduled polling.
// Normal booking volume must NOT translate into one Firestore snapshot read
// per Traveler quote. The TTL is short so approved pricing changes propagate.
function createReferenceCache({ load, now = () => Date.now(), ttlMs = 30_000, maxEntries = 128 } = {}) {
  if (typeof load !== 'function') throw new TypeError('load function required');
  if (!Number.isSafeInteger(ttlMs) || ttlMs < 1000) throw new RangeError('invalid TTL');
  if (!Number.isSafeInteger(maxEntries) || maxEntries < 1 || maxEntries > 1024) throw new RangeError('invalid capacity');
  const entries = new Map();
  async function read(id) {
    const key = String(id || '').trim();
    if (!key || key.length > 150) return null;
    const time = now();
    const previous = entries.get(key);
    if (previous && time < previous.expiresAt) return previous.promise;
    entries.delete(key);
    // Store the in-flight Promise BEFORE awaiting it, so concurrent quotations
    // of the same market collapse to one paid Firestore read.
    const promise = Promise.resolve().then(() => load(key)).catch(error => {
      if (entries.get(key)?.promise === promise) entries.delete(key);
      throw error; // never cache quota/outage failures as if they were "no source".
    });
    entries.set(key, { promise, expiresAt: time + ttlMs });
    while (entries.size > maxEntries) entries.delete(entries.keys().next().value);
    return promise;
  }
  return {
    read,
    invalidate(id) { entries.delete(String(id || '').trim()); },
    size() { return entries.size; },
  };
}
module.exports = { createReferenceCache };
