// The §627.748(8)(a) insurance disclosure, fetched rather than embedded.
//
// The statute requires the disclosure "in writing", which means the words an operator agreed
// to and the words American Rider can produce afterwards must be the same words. Embedding
// them in the app would put them in a build that can differ from the record — so the text
// comes from the server, and the acknowledgement is stored there with it.
import { PAYMENT_SERVER_URL } from '../config';
import { auth } from '../firebase';
import { t } from '../i18n';

export type DisclosureSection = { heading: string; body: string };
export type Disclosure = {
  version: string;
  statute: string;
  title: string;
  provided: DisclosureSection;
  ownPolicy: DisclosureSection;
  required: DisclosureSection;
  acknowledgement: string;
};

async function authHeaders() {
  const token = await auth.currentUser?.getIdToken().catch(() => null);
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

/** The current disclosure and whether this operator has acknowledged it. Null if unreachable. */
export async function fetchDisclosure(): Promise<{
  disclosure: Disclosure;
  acknowledged: boolean;
  acknowledgedAt: number | null;
} | null> {
  try {
    const res = await fetch(`${PAYMENT_SERVER_URL}/operator/disclosure`, {
      headers: await authHeaders(),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

/**
 * Record that this operator has read it.
 *
 * Never optimistic. The screen may only say "acknowledged" once the server has stored it —
 * this is the record that proves a statutory disclosure was made, and a local flag that never
 * reached the database would be a claim with nothing behind it.
 */
export async function acknowledgeDisclosure(): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const res = await fetch(`${PAYMENT_SERVER_URL}/operator/disclosure/acknowledge`, {
      method: 'POST',
      headers: await authHeaders(),
    });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, error: d?.error || `Could not record it (${res.status}).` };
    return { ok: true };
  } catch {
    return { ok: false, error: t('traveler.errReachARRetry') };
  }
}
