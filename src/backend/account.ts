import { PAYMENT_SERVER_URL } from '../config';
import { auth } from '../firebase';

/** Stop future scheduled Travel and Operator dispatch before the login is removed. */
export async function closeOperationalAccount(): Promise<void> {
  const token = await auth.currentUser?.getIdToken();
  if (!token) throw new Error('account_required');
  const res = await fetch(`${PAYMENT_SERVER_URL}/account/close`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const error = new Error(String(body?.error || 'account_close_failed')) as Error & { code?: string };
    error.code = String(body?.code || 'account_close_failed');
    throw error;
  }
}