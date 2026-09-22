// Per-account limits on the routes a throwaway account can abuse.
//
// WHY THIS EXISTS, AND WHY IT IS NOT TWILIO. Adrian asked what stops somebody making hundreds
// of accounts and annoying the platform, and the answer offered was phone verification — a
// paid vendor. He pushed back: "you said we didn't need it, Stripe does everything." He was
// closer to right than the recommendation was.
//
// WHAT STRIPE ALREADY PROTECTS. A travel cannot be booked without a payment method, and a card
// is far harder to obtain in volume than an email address. So fake accounts cannot dispatch
// cars, cannot cost us an operator's time, and cannot take a seat from a real traveler. The
// expensive half of the abuse surface was already closed, and closed by something we own.
//
// WHAT NOTHING PROTECTED. Everything that needs only a signed-in account: support cases (each
// one runs a model and may reach a person), lost-item reports (each one may notify an
// operator), and emergency alerts. There was no limit of any kind on any of them. A comment in
// server.js asserted "requireAuth rate-limits per account" — requireAuth authenticates and
// does nothing else, which is the most dangerous shape a comment can take.
//
// AND AN EMERGENCY IS NEVER REFUSED FOR BEING TOO FREQUENT. It is counted, and a burst is
// flagged for a person rather than blocked. Somebody in real trouble may well press it
// repeatedly, and a platform that answers "you have done that too many times" to that person
// has failed at the only thing it absolutely must not fail at. The limit exists to make abuse
// VISIBLE, not to gate the alarm.
//
// IN MEMORY, PER INSTANCE, AND HONEST ABOUT IT. Counters reset on deploy and are not shared
// between instances, so this is a speed bump rather than a wall. It is worth having anyway: it
// costs nothing, it stops the cheap script, and the expensive script still has to buy cards.
// A shared counter belongs in Firestore when there is more than one instance to share it.

const WINDOWS = new Map();

/** Strip counters nothing has touched for an hour, so the map cannot grow without bound. */
function sweep(now) {
  if (WINDOWS.size < 5000) return;
  for (const [k, v] of WINDOWS) if (now - v.start > 3_600_000) WINDOWS.delete(k);
}

/**
 * Count one use and say whether it is over the limit.
 * Returns { ok, count, limit, retryAfterSeconds }.
 */
function hit(key, limit, windowMs, now = Date.now()) {
  sweep(now);
  const rec = WINDOWS.get(key);
  if (!rec || now - rec.start >= windowMs) {
    WINDOWS.set(key, { start: now, count: 1 });
    return { ok: true, count: 1, limit, retryAfterSeconds: 0 };
  }
  rec.count += 1;
  const ok = rec.count <= limit;
  return {
    ok,
    count: rec.count,
    limit,
    retryAfterSeconds: ok ? 0 : Math.ceil((rec.start + windowMs - now) / 1000),
  };
}

/**
 * Express middleware. `limit` uses per `windowMs`, keyed on the signed-in account.
 *
 * MOUNT IT AFTER requireAuth. Keyed on the uid rather than the IP because an IP is shared by
 * everybody on a hotel's wifi and changes for one person between two streets — limiting by it
 * punishes the wrong people in both directions.
 */
function perAccount({ name, limit, windowMs }) {
  return (req, res, next) => {
    const uid = req.uid ? String(req.uid) : null;
    if (!uid) return next(); // requireAuth's job, not this one's.
    const r = hit(`${name}:${uid}`, limit, windowMs);
    if (r.ok) return next();
    res.set('Retry-After', String(r.retryAfterSeconds));
    return res.status(429).json({
      error: 'That has been sent several times already. The earlier ones are with us.',
      code: 'too_many',
      retryAfterSeconds: r.retryAfterSeconds,
    });
  };
}

/**
 * The same, keyed on the caller's address — for the few routes that answer without a sign-in
 * (quotes, routes, destinations). Looser than perAccount for the reason that comment gives: an
 * address is shared. It exists so an unauthenticated loop cannot run up routing and database
 * cost, not to meter a person. Relies on `trust proxy` so req.ip is the client, not Render.
 */
function perIp({ name, limit, windowMs }) {
  return (req, res, next) => {
    const r = hit(`${name}:ip:${req.ip || 'unknown'}`, limit, windowMs);
    if (r.ok) return next();
    res.set('Retry-After', String(r.retryAfterSeconds));
    return res.status(429).json({ error: 'Too many requests. Try again shortly.', code: 'too_many', retryAfterSeconds: r.retryAfterSeconds });
  };
}

/** Count without refusing — for the routes that must never be blocked. */
function countOnly({ name, limit, windowMs }) {
  return (req, res, next) => {
    const uid = req.uid ? String(req.uid) : null;
    if (uid) {
      const r = hit(`${name}:${uid}`, limit, windowMs);
      // Read by the route, which records the burst rather than refusing it.
      req.rateBurst = r.ok ? null : { name, count: r.count, limit: r.limit };
    }
    next();
  };
}

/** For tests. */
function reset() { WINDOWS.clear(); }

module.exports = { perAccount, countOnly, hit, reset, perIp };
