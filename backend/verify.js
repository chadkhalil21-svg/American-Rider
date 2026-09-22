// Phone number verification — Twilio Verify.
//
// WHY IT EXISTS (Chad, 19 Sept 2026, directive 2). The application has collected a mobile
// number at sign-up since the beginning and has never checked that it belongs to the person
// typing it. Two things follow. An account can be created in bulk against numbers nobody
// owns, which is the cheap end of fraud. And the number on a travel — the one an operator
// would ring from a kerb, the one Patron Support calls back after an incident — is whatever
// somebody typed, which is the expensive end.
//
// WHAT THIS IS NOT. It is not identity verification and it is not tax reporting. A verified
// number proves somebody held that handset a moment ago and nothing else. Operator tax
// identity for a 1099 is Stripe Connect's own flow and is not touched here.
//
// NO CREDENTIALS, NO FEATURE, AND THE APP IS TOLD SO. Every other integration in this
// directory works that way — Checkr, Resend, Stripe — because a feature that half-exists is
// worse than one that is plainly absent. `ready()` is false without the three values and the
// routes answer 503 with a reason, rather than pretending a code was sent.
//
// THE CODE IS NEVER IN OUR HANDS. Twilio generates it, sends it and checks it. We store no
// code, no hash of one, and no attempt counter — Twilio owns the rate limiting, the expiry
// and the lockout, which is the whole reason to use Verify rather than send an SMS ourselves.
const { readKey } = require('./env');

const SID = () => readKey('TWILIO_ACCOUNT_SID');
const TOKEN = () => readKey('TWILIO_AUTH_TOKEN');
const SERVICE = () => readKey('TWILIO_VERIFY_SERVICE_SID');

/** Is Twilio Verify configured at all? `/health` reports this so a silent outage is impossible. */
const ready = () => !!(SID() && TOKEN() && SERVICE());

function authHeader() {
  return 'Basic ' + Buffer.from(`${SID()}:${TOKEN()}`).toString('base64');
}

/**
 * E.164, or null.
 *
 * TWILIO REFUSES ANYTHING ELSE, and the refusal arrives as a 60200 an hour after somebody
 * typed their number with brackets in it. A US ten-digit number is the overwhelming case here
 * — service begins in South Florida — so it is normalised rather than rejected. Anything
 * already carrying a + is passed through with its punctuation removed and nothing assumed.
 */
function toE164(input) {
  const raw = String(input || '').trim();
  if (!raw) return null;
  if (raw.startsWith('+')) {
    const digits = raw.slice(1).replace(/\D/g, '');
    return digits.length >= 8 && digits.length <= 15 ? `+${digits}` : null;
  }
  const d = raw.replace(/\D/g, '');
  if (d.length === 10) return `+1${d}`;
  if (d.length === 11 && d.startsWith('1')) return `+${d}`;
  return null;
}

/**
 * Send a code. Returns { ok } or { ok:false, reason, code }.
 *
 * NEVER THROWS, like every other outward call in this directory: a verification that cannot be
 * sent must not take down the sign-up it was part of.
 */
async function startVerification(phone) {
  if (!ready()) return { ok: false, code: 'not_configured', reason: 'Phone verification is not configured.' };
  const to = toE164(phone);
  if (!to) return { ok: false, code: 'bad_number', reason: 'That does not look like a mobile number.' };
  try {
    const r = await fetch(`https://verify.twilio.com/v2/Services/${SERVICE()}/Verifications`, {
      method: 'POST',
      headers: { Authorization: authHeader(), 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ To: to, Channel: 'sms' }).toString(),
    });
    if (!r.ok) {
      const body = await r.text();
      // 60200 is an invalid number, 60203 is too many attempts on the same one. Both are the
      // person's to act on, so they are named; everything else is ours and is logged as ours.
      const tooMany = body.includes('60203');
      return {
        ok: false,
        code: tooMany ? 'too_many' : 'send_failed',
        reason: tooMany
          ? 'Too many codes have been requested for that number. Try again later.'
          : 'The code could not be sent.',
        detail: body.slice(0, 200),
      };
    }
    return { ok: true, to };
  } catch (e) {
    return { ok: false, code: 'send_failed', reason: 'The code could not be sent.', detail: e.message };
  }
}

/**
 * Check a code. Returns { ok:true } only on Twilio's own "approved".
 *
 * ANY OTHER ANSWER IS A FAILURE, including an unreachable Twilio. "We could not check" must
 * never read as "verified" — this is the whole point of the function.
 */
async function checkVerification(phone, code) {
  if (!ready()) return { ok: false, code: 'not_configured', reason: 'Phone verification is not configured.' };
  const to = toE164(phone);
  if (!to) return { ok: false, code: 'bad_number', reason: 'That does not look like a mobile number.' };
  const digits = String(code || '').replace(/\D/g, '');
  if (!digits) return { ok: false, code: 'bad_code', reason: 'Enter the code from the message.' };
  try {
    const r = await fetch(`https://verify.twilio.com/v2/Services/${SERVICE()}/VerificationCheck`, {
      method: 'POST',
      headers: { Authorization: authHeader(), 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ To: to, Code: digits }).toString(),
    });
    const body = await r.json().catch(() => ({}));
    if (r.ok && body.status === 'approved') return { ok: true, to };
    // Twilio deletes a verification after it is approved or expires, so a 404 here is a code
    // that has already been used or has run out. Both mean "ask for a new one".
    if (r.status === 404) {
      return { ok: false, code: 'expired', reason: 'That code has expired. Ask for a new one.' };
    }
    return { ok: false, code: 'wrong_code', reason: 'That code is not right.' };
  } catch (e) {
    return { ok: false, code: 'check_failed', reason: 'The code could not be checked.', detail: e.message };
  }
}

module.exports = { ready, toE164, startVerification, checkVerification };
