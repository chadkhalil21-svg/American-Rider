'use strict';

// Stripe Connect is an event-driven eligibility source, not GPS telemetry.
// Authoritative references: https://docs.stripe.com/connect/webhooks
// and https://docs.stripe.com/rate-limits
//
// Freshly entering duty and accepting a paid Travel still retrieve Stripe directly.
// Between those boundaries, the server can reuse an authenticated Stripe response or
// signed account.updated event, without hitting Stripe on every location renewal.
// Keep a finite hard expiry for missed webhooks; never use client-supplied status.
// This is a safety bound, NOT a national-capacity certification.
const { PRESENCE_STALE_MS } = require('./matching');
const STRIPE_DUTY_MAX_AGE_MS = 24 * 60 * 60 * 1000;

function cachedPayoutStatus({ accountId, fleet, now = Date.now() } = {}) {
  if (!accountId || !fleet || fleet.available !== true ||
      fleet.payoutsEnabled !== true || fleet.stripeAccountId !== accountId) return null;
  // A returning app is a NEW shift if the device was absent for five minutes.
  // Do not resume a stale fleet entry using an old positive Stripe attestation.
  const lastSeen = Number(fleet.onlineAt);
  if (!Number.isFinite(lastSeen) || lastSeen <= 0 || lastSeen > now ||
      now - lastSeen >= PRESENCE_STALE_MS) return null;
  const checkedAt = Number(fleet.stripeCheckedAt);
  if (!Number.isFinite(checkedAt) || checkedAt <= 0 || checkedAt > now ||
      now - checkedAt >= STRIPE_DUTY_MAX_AGE_MS) return null;
  return { payoutsEnabled: true, due: [], cached: true, stripeCheckedAt: checkedAt };
}

module.exports = { STRIPE_DUTY_MAX_AGE_MS, cachedPayoutStatus };
