// App-side operator screening. The app describes and pays; the SERVER orders and decides.
//
// WHAT THIS REPLACES. app/operator/background.tsx was the last screen still on the test
// program: its button marked the document verified in the phone's memory and no check was
// ever ordered — said honestly on the screen, and honest was the best that flow could be.
// With the Checkr account credentialed (26 Aug 2026) the real pipeline exists end to end:
// pay the pass-through fee → the server orders from Checkr → the operator finishes Checkr's
// own hosted forms from their email → the server adjudicates the result by statute and
// records it. Every function here returns what actually happened, including failure, so the
// screen can never claim more than took place — the same rule as support.ts.
import { initPaymentSheet, presentPaymentSheet } from '@stripe/stripe-react-native';
import { PAYMENT_SERVER_URL } from '../config';
import { auth } from '../firebase';
import { t } from '../i18n';

async function authHeaders(): Promise<Record<string, string>> {
  const token = await auth.currentUser?.getIdToken().catch(() => null);
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

/** The server's record of this operator's screening, verbatim. */
export type ScreeningRecord = {
  decision?:
    | 'pass'
    | 'refuse'
    | 'review'
    | 'invited'
    | 'in_progress'
    | 'ordered'
    | 'expired'
    | 'awaiting_provider'
    | 'awaiting_agency';
  summary?: string;
  reasons?: string[];
  /** 'checkr' for one we ordered; the agency's name for a transferred report. */
  provider?: string | null;
  feeCents?: number;
  invitationUrl?: string | null;
  invitationExpiresAt?: number | null;
  conductedAt?: number;
  recheckDue?: number;
  /** Where a previous screening company should send a transferred report, and the case to cite. */
  transferTo?: string | null;
  transferCaseNo?: string | null;
} | null;

/** The itemized quote: the check's cost, the card processor's cut, and their sum. */
export type ScreeningQuote = { costCents: number; processingCents: number; totalCents: number };

export type ScreeningStatus = {
  ok: boolean;
  feeCents: number;
  /** Itemized cost + processing = total. The operator sees all three numbers (Chad, 27 Aug). */
  quote?: ScreeningQuote;
  /** 'checkr' when screening is live; null while the platform is pre-provider. */
  provider: string | null;
  screening: ScreeningRecord;
  error?: string;
};

/** Where this operator stands, from the server's record — never from the phone's. */
export async function fetchScreening(): Promise<ScreeningStatus> {
  try {
    const res = await fetch(`${PAYMENT_SERVER_URL}/operator/screening`, {
      headers: await authHeaders(),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return { ok: false, feeCents: 4749, provider: null, screening: null, error: data?.error };
    }
    return { ok: true, feeCents: data.feeCents, quote: data.quote, provider: data.provider, screening: data.screening };
  } catch {
    return {
      ok: false,
      feeCents: 4749,
      provider: null,
      screening: null,
      error: t('traveler.errReachARNoStop'),
    };
  }
}

export type ScreeningPayment =
  | { ok: true; paymentIntentId: string }
  | { ok: false; canceled?: boolean; error?: string };

/**
 * The pass-through fee, paid in Stripe's own sheet. The server prices it from OUR record of
 * what this operator owes ($47.49, or $17.50 when an accepted report covers the criminal
 * half) — the app never sends an amount.
 */
export async function payScreeningFee(): Promise<ScreeningPayment> {
  let intent: {
    clientSecret?: string;
    paymentIntentId?: string;
    customerId?: string;
    ephemeralKeySecret?: string;
  };
  try {
    const res = await fetch(`${PAYMENT_SERVER_URL}/operator/screening/intent`, {
      method: 'POST',
      headers: await authHeaders(),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, error: data?.error || `Server error ${res.status}` };
    intent = data;
  } catch {
    return { ok: false, error: t('traveler.paymentServerUnreachable') };
  }
  if (!intent.clientSecret || !intent.paymentIntentId) {
    return { ok: false, error: t('traveler.errPaymentNotStarted') };
  }

  const init = await initPaymentSheet({
    merchantDisplayName: 'American Rider',
    paymentIntentClientSecret: intent.clientSecret,
    customerId: intent.customerId,
    customerEphemeralKeySecret: intent.ephemeralKeySecret,
    allowsDelayedPaymentMethods: true,
    returnURL: 'americanrider://stripe-redirect',
  });
  if (init.error) return { ok: false, error: init.error.message };

  const presented = await presentPaymentSheet();
  if (presented.error) {
    const canceled = presented.error.code === 'Canceled';
    return { ok: false, canceled, error: canceled ? undefined : presented.error.message };
  }
  return { ok: true, paymentIntentId: intent.paymentIntentId };
}

export type OrderOutcome = {
  ok: boolean;
  /** False while the platform has no screening provider — paid, recorded, not yet ordered. */
  ordered?: boolean;
  invitationUrl?: string | null;
  error?: string;
};

/** Order the check the fee just paid for. The server verifies the payment against Stripe. */
export async function orderScreening(paymentIntentId: string): Promise<OrderOutcome> {
  try {
    const res = await fetch(`${PAYMENT_SERVER_URL}/operator/screening/order`, {
      method: 'POST',
      headers: await authHeaders(),
      body: JSON.stringify({ paymentIntentId }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, error: data?.error || `Server error ${res.status}` };
    return { ok: true, ordered: !!data.ordered, invitationUrl: data.invitationUrl || null };
  } catch {
    return { ok: false, error: t('traveler.errReachARNoStop') };
  }
}

/** A fresh Checkr link for a paid screening whose invitation expired. No new payment. */
export async function reinviteScreening(): Promise<OrderOutcome> {
  try {
    const res = await fetch(`${PAYMENT_SERVER_URL}/operator/screening/reinvite`, {
      method: 'POST',
      headers: await authHeaders(),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, error: data?.error || `Server error ${res.status}` };
    return { ok: true, ordered: true, invitationUrl: data.invitationUrl || null };
  } catch {
    return { ok: false, error: t('traveler.errReachARNoStop') };
  }
}

/**
 * The free route: instruct a screening company that already checked this operator to send
 * the report to American Rider (FCRA §604(a)(2) — the consumer's own written instruction).
 * Nothing is accepted from the operator's hands; the server opens a case to receive it from
 * the company directly.
 */
export async function declareExistingScreening(opts: {
  agency: string;
  /** Approximate; the report's own date governs when it arrives. */
  issuedAt?: number;
  criminalIncluded: boolean;
  drivingIncluded: boolean;
}): Promise<{ ok: boolean; feeCents?: number; note?: string; transferTo?: string | null; transferCaseNo?: string | null; error?: string }> {
  const elements = [
    ...(opts.criminalIncluded ? ['nationwide_criminal', 'sex_offender'] : []),
    ...(opts.drivingIncluded ? ['driving_history'] : []),
  ];
  try {
    const res = await fetch(`${PAYMENT_SERVER_URL}/operator/screening/existing`, {
      method: 'POST',
      headers: await authHeaders(),
      body: JSON.stringify({
        agency: opts.agency,
        issuedAt: opts.issuedAt || 0,
        elements,
        consent: true,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, error: data?.error || `Server error ${res.status}` };
    return { ok: true, feeCents: data.feeCents, note: data.note, transferTo: data.transferTo, transferCaseNo: data.transferCaseNo };
  } catch {
    return { ok: false, error: t('traveler.errReachARNoStop') };
  }
}
