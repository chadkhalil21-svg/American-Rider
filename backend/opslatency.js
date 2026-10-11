'use strict';
// Bound founder Operations page and MFA responsiveness when Firestore is quota-limited.
// A deadline changes the HTTP response, NEVER turns a missing security record into approval.
// Backend operations may settle later; callers must never infer their success from timeout.
const OPS_MFA_DEADLINE_MS = 8000;
const OPS_BOARD_DEADLINE_MS = 8000;
function withinDeadline(task, deadlineMs) {
  if (!Number.isInteger(deadlineMs) || deadlineMs <= 0 || deadlineMs > 60000)
    throw new TypeError('Invalid Operations deadline');
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => {
      const error = new Error('Operations storage did not respond within the time limit');
      error.code = 'OPS_STORAGE_TIMEOUT';
      reject(error);
    }, deadlineMs);
  });
  return Promise.race([Promise.resolve().then(task), timeout]).finally(() => clearTimeout(timer));
}
module.exports = { withinDeadline, OPS_MFA_DEADLINE_MS, OPS_BOARD_DEADLINE_MS };
