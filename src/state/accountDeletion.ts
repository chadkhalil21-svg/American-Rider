import { EmailAuthProvider, reauthenticateWithCredential, type User } from 'firebase/auth';

export type AccountAuthProvider = 'password' | 'apple' | 'google' | 'unsupported';

/** Select a credential mechanism already linked to this Firebase account. */
export function accountAuthProvider(
  providerIds: readonly string[],
  available: { apple: boolean; google: boolean } = { apple: true, google: true },
): AccountAuthProvider {
  if (available.apple && providerIds.includes('apple.com')) return 'apple';
  if (available.google && providerIds.includes('google.com')) return 'google';
  if (providerIds.includes('password')) return 'password';
  return 'unsupported';
}

export async function reauthenticateWithPassword(user: User, password: string): Promise<void> {
  if (!user.email || !password) {
    const error = new Error('Password required') as Error & { code?: string };
    error.code = 'auth/invalid-credential';
    throw error;
  }
  await reauthenticateWithCredential(
    user,
    EmailAuthProvider.credential(user.email, password),
  );
}

/** Preserve cancellation as a failure. The deletion sequence must not start after it. */
export function providerResultError(result: {
  ok: boolean;
  cancelled?: boolean;
  reason?: string;
}): Error & { code?: string } {
  const error = new Error(result.reason || 'Recent authentication failed') as Error & {
    code?: string;
  };
  error.code = result.cancelled ? 'auth/reauthentication-cancelled' : 'auth/invalid-credential';
  return error;
}