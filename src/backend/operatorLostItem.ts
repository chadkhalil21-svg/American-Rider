import { auth } from '../firebase';
import { PAYMENT_SERVER_URL } from '../config';

export type OperatorLostItem = {
  id: string;
  tripNo: string | null;
  candidateTripNos: string[];
  description: string;
  status: string;
  response?: { outcome: 'located' | 'not-found'; tripNo?: string | null; at: number } | null;
  createdAt: number;
};

async function headers() {
  const token = await auth.currentUser?.getIdToken().catch(() => null);
  return { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) };
}
export async function fetchOperatorLostItem(id: string): Promise<OperatorLostItem> {
  const res = await fetch(`${PAYMENT_SERVER_URL}/operator/lost-item/${encodeURIComponent(id)}`, { headers: await headers() });
  const out = await res.json().catch(() => ({}));
  if (!res.ok || !out?.item) throw new Error(out?.error || 'lost_item_unavailable');
  return out.item;
}
export async function respondOperatorLostItem(id: string, outcome: 'located' | 'not-found', tripNo?: string | null) {
  const res = await fetch(`${PAYMENT_SERVER_URL}/operator/lost-item/${encodeURIComponent(id)}/respond`, {
    method: 'POST', headers: await headers(), body: JSON.stringify({ outcome, tripNo: tripNo || null }),
  });
  const out = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(out?.error || 'lost_item_response_failed');
  return out;
}
