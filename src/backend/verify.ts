import { PAYMENT_SERVER_URL } from '../config';
import { auth } from '../firebase';

async function call(path: string, body: Record<string, unknown>) {
  const token = await auth.currentUser?.getIdToken();
  if (!token) throw new Error('account_required');
  const res = await fetch(`${PAYMENT_SERVER_URL}${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const error = new Error(String(data?.error || 'verification_failed')) as Error & { code?: string };
    error.code = String(data?.code || 'verification_failed');
    throw error;
  }
  return data;
}

export async function startMobileVerification(phone: string): Promise<void> {
  await call('/verify/start', { phone });
}

export async function checkMobileVerification(phone: string, code: string): Promise<string> {
  const data = await call('/verify/check', { phone, code });
  return String(data?.phone || phone);
}
