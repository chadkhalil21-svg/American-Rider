'use strict';

// Prevent a second clock tick (or authenticated manual sweep) from starting while the
// previous sweep is still running in this process. This is a concurrency guard, not
// a replacement for the Firestore cross-instance lease.
function singleFlight(task) {
  if (typeof task !== 'function') throw new TypeError('task must be a function');
  let running = false;
  return async (...args) => {
    if (running) return { ok: true, skipped: 'same-instance sweep already running' };
    running = true;
    try {
      return await task(...args);
    } finally {
      running = false;
    }
  };
}

module.exports = { singleFlight };
