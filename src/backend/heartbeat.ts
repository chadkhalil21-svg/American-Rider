// Keeping the clock running, for nothing.
//
// THE PROBLEM. Scheduled travel and route monitoring both run on a 60-second sweep inside the
// server. On Render's free tier the instance sleeps when nothing has called it for a while,
// and a sleeping process has no interval — so a 6:30 AM reservation does not dispatch, and a
// stopped car is not noticed. The usual fix is an outside pinger (cron-job.org) or $7 a month.
//
// THE OBSERVATION THAT MAKES THIS FREE. The people who most need the clock running are already
// holding phones that can wake the server: an operator ON DUTY is, by definition, waiting to be
// dispatched to. So the operator app pings while on duty, and the traveler app pings when it
// opens. The server is awake exactly when there is somebody to dispatch to, and asleep when
// there is nobody it could have dispatched to anyway.
//
// WHAT THIS IS NOT. It is not a substitute for a real pinger in every case — a reservation for
// 6:30 AM with no operator on duty and nobody holding a phone still needs cron-job.org or a
// paid instance. It removes the common case, not the whole problem, and docs/LAUNCH-NOW.md §2
// says so rather than implying this is enough on its own.
import { PAYMENT_SERVER_URL } from '../config';

// Never more often than this, whoever asks. Several screens may call ping() at once, and the
// server throttles a real sweep to one per ten seconds anyway — this stops us making the
// request at all.
const MIN_GAP_MS = 45_000;
let lastPing = 0;

/**
 * Wake the server and let it run its sweep.
 *
 * Fire and forget, and silent on failure: nothing in either app may wait on this, and a phone
 * with no signal must not show an error for a housekeeping call it did not ask for.
 */
export function pingSweep(): void {
  const now = Date.now();
  if (now - lastPing < MIN_GAP_MS) return;
  lastPing = now;
  // No auth header. The endpoint takes no parameters and can only do what the server's own
  // clock would do a minute later — see the note above POST /scheduled/sweep.
  fetch(`${PAYMENT_SERVER_URL}/scheduled/sweep`).catch(() => {});
}

/**
 * Ping on a timer for as long as the caller keeps the returned stopper.
 *
 * Used while an operator is on duty. Sixty seconds matches the server's own interval, so the
 * sweep runs at its designed resolution rather than whenever somebody happens to open a screen.
 */
export function startHeartbeat(everyMs = 60_000): () => void {
  pingSweep();
  const t = setInterval(pingSweep, everyMs);
  return () => clearInterval(t);
}
