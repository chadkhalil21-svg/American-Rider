// One way to turn a stored ride into a Travel Receipt.
//
// Two screens open receipts — the Travel Log and the home screen's Recent Travel list —
// and before this they each did the arithmetic themselves. That is exactly how the
// account-name drift happened (five places deriving one value, four of them agreeing).
// The fare model lives in src/data.ts; this is the only place that reads a RideRecord
// and shapes it for app/receipt.tsx.
import { PaidWith, RideRecord } from './backend/dispatch';
import { brandName } from './backend/payments';
import { coordinationFee, fareFromTotal, type FeeLine } from './data';
import { travelDate, travelDateShort, travelDateTime } from './dates';
import type { LanguageCode } from './i18n';

type Translate = (key: string, params?: Record<string, unknown>) => string;

export type ViewTrip = {
  arr: string;
  dep: string;
  cost: number;
  proc: number;
  total: number;
  opRev: number;
  operator?: string;
  pay: string;
  no: string;
  date: string;
  subPrefix: string;
  /** Road miles and boarding-to-completion minutes — Fla. Stat. 627.748(6). Absent when the
   *  record predates them; the receipt then says "Not recorded" rather than guessing. */
  miles?: number;
  minutes?: number;
  creditCents?: number;
  feeLines?: FeeLine[];
  /** The day the server emailed this receipt to the traveler; absent when it did not. */
  emailed?: string;
};

/**
 * The method that paid, as the traveler knows it: "Visa ···· 4242", "Apple Pay · Visa ···· 4242",
 * "Bank account ···· 6789". Empty when the record does not say.
 *
 * WHY THE RECORD, NOT THE PHONE. Until 15 Sept 2026 a receipt printed the payment mode the app
 * had selected on the day it was opened — the same "Bank account" on every past travel, whatever
 * had actually been charged. What paid is written onto the travel by the server at settlement,
 * from the charge Stripe recorded (backend/payments.js paidWithFromIntent); where a travel was
 * settled before that existed, the screen says "Not recorded" rather than guessing.
 */
export function describePaidWith(p: PaidWith | undefined, t: Translate): string {
  if (!p) return '';
  const wallet = p.wallet === 'apple_pay' ? 'Apple Pay' : p.wallet === 'google_pay' ? 'Google Pay' : null;
  const isBank = p.type === 'us_bank_account' || (!p.brand && p.type !== 'card');
  const name = isBank
    ? p.last4
      ? t('traveler.bankEnding', { last4: p.last4 })
      : t('traveler.bankAccount')
    : p.last4
      ? t('traveler.cardEnding', { brand: brandName(p.brand), last4: p.last4 })
      : brandName(p.brand);
  if (!name) return '';
  const withBank = isBank && p.bank ? `${name} · ${p.bank}` : name;
  return wallet ? `${wallet} · ${withBank}` : withBank;
}

export function receiptFromRide(r: RideRecord, language: LanguageCode, t: Translate): ViewTrip {
  const total = r.totalCents / 100;
  // The traveler paid ONE all-in price = fare + platform fee + any government fee. Everything
  // else is derived, never stored, so a receipt can never disagree with what was charged.
  const governmentFee = (r.governmentFeeCents ?? 0) / 100;
  const cost = fareFromTotal(+(total - governmentFee).toFixed(2));
  const minutes =
    r.onboardAt && r.completedAt && r.completedAt > r.onboardAt
      ? Math.max(1, Math.round((r.completedAt - r.onboardAt) / 60000))
      : undefined;
  return {
    miles: r.miles,
    minutes,
    feeLines: r.feeLines,
    arr: r.arr,
    dep: r.dep,
    cost,
    proc: 0, // the platform fee absorbs processing — never billed on top, never shown
    total,
    opRev: cost - coordinationFee(cost), // the operator's 99%
    operator: r.operatorName,
    pay: describePaidWith(r.paidWith, t),
    no: r.tripNo || r.id,
    date: travelDateTime(r.createdAt, language),
    subPrefix: travelDateShort(r.createdAt, language),
    emailed: r.receiptSentAt ? travelDate(r.receiptSentAt, language) : undefined,
  };
}
