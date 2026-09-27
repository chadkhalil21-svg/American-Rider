// American Rider — provider-neutral Operator screening.
//
// Screening is procured through an approved consumer reporting agency workflow. The Operator
// pays that provider directly. American Rider does not sell or mark up screening and does not
// accept an Operator-uploaded copy as authoritative evidence.
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

export type ScreeningRecord = {
  decision?: 'pass' | 'refuse' | 'review' | 'in_progress' | 'awaiting_agency' | 'expired';
  summary?: string;
  reasons?: string[];
  provider?: string | null;
  conductedAt?: number;
  recheckDue?: number;
  transferTo?: string | null;
  transferCaseNo?: string | null;
} | null;

export type ScreeningStatus = {
  ok: boolean;
  jurisdiction?: { state: string; name?: string; statute?: string; recheckYears?: number } | null;
  provider: 'external' | null;
  providerUrl?: string | null;
  screening: ScreeningRecord;
  error?: string;
};

export async function fetchScreening(): Promise<ScreeningStatus> {
  try {
    const res = await fetch(`${PAYMENT_SERVER_URL}/operator/screening`, {
      headers: await authHeaders(),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, provider: null, screening: null, error: data?.error };
    return {
      ok: true,
      jurisdiction: data.jurisdiction || null,
      provider: data.provider === 'external' ? 'external' : null,
      providerUrl: typeof data.providerUrl === 'string' ? data.providerUrl : null,
      screening: data.screening || null,
    };
  } catch {
    return { ok: false, provider: null, screening: null, error: t('traveler.errReachARNoStop') };
  }
}

export async function declareExistingScreening(opts: {
  agency: string;
  issuedAt?: number;
  criminalIncluded: boolean;
  drivingIncluded: boolean;
}): Promise<{ ok: boolean; note?: string; transferTo?: string | null; transferCaseNo?: string | null; error?: string }> {
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
    return { ok: true, note: data.note, transferTo: data.transferTo, transferCaseNo: data.transferCaseNo };
  } catch {
    return { ok: false, error: t('traveler.errReachARNoStop') };
  }
}
