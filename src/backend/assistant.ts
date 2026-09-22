// App-side helper for the AI trip assistant. Sends the traveler's message to the server
// (which holds the Claude key) and gets back a structured plan.
import { PAYMENT_SERVER_URL } from '../config';
import { auth } from '../firebase';
import { t } from '../i18n';

export type TripPlan = {
  reply: string;
  destination: string; // one of the bookable places, or "" if none matched
  when: string;
  passengers: number;
  prefs: string[];
};

export type AssistantResult = { ok: true; plan: TripPlan } | { ok: false; error: string };

export async function askAssistant(message: string): Promise<AssistantResult> {
  try {
    const token = await auth.currentUser?.getIdToken();
    const res = await fetch(`${PAYMENT_SERVER_URL}/assistant`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ message }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, error: data?.error || `Server error ${res.status}` };
    return { ok: true, plan: data as TripPlan };
  } catch {
    return { ok: false, error: t('traveler.errAssistantUnreachable') };
  }
}
