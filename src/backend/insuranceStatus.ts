// Operator-facing continuing insurance-status workflow.
import { PAYMENT_SERVER_URL } from '../config';
import { auth } from '../firebase';

export type InsuranceStatus = {
  ok: boolean;
  status: string;
  code?: string | null;
  reason?: string | null;
  lastVerifiedAt?: number | null;
  operatorAttestedAt?: number | null;
  nextVerificationDueAt?: number | null;
  operatorActionRequired?: boolean;
  graceUntil?: number | null;
  contact?: { name?: string; email?: string; type?: string } | null;
};

async function headers() {
  const token = await auth.currentUser?.getIdToken().catch(() => null);
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

export async function insuranceStatus(): Promise<InsuranceStatus | null> {
  try {
    const r = await fetch(`${PAYMENT_SERVER_URL}/operator/insurance/status`, { headers: await headers() });
    return r.ok ? await r.json() : null;
  } catch { return null; }
}

export async function attestInsuranceUnchanged(): Promise<InsuranceStatus | null> {
  try {
    const r = await fetch(`${PAYMENT_SERVER_URL}/operator/insurance/attest`, {
      method: 'POST', headers: await headers(), body: '{}',
    });
    return r.ok ? await r.json() : null;
  } catch { return null; }
}

export async function requestInsuranceConfirmation(contact: {
  name?: string;
  email: string;
  type?: 'agent' | 'broker' | 'carrier';
}): Promise<{ ok: boolean; error?: string }> {
  try {
    const r = await fetch(`${PAYMENT_SERVER_URL}/operator/insurance/request-confirmation`, {
      method: 'POST',
      headers: await headers(),
      body: JSON.stringify(contact),
    });
    const d = await r.json().catch(() => ({}));
    return r.ok ? { ok: true } : { ok: false, error: d?.error || `Server error ${r.status}` };
  } catch {
    return { ok: false, error: 'American Rider could not reach the insurance-status service.' };
  }
}