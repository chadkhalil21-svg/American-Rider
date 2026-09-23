// American Rider — real authentication state (Firebase).
// Tracks the signed-in user and exposes sign up / sign in / sign out.
import { updateProfile,
  createUserWithEmailAndPassword,
  deleteUser,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut as fbSignOut,
  User,
} from 'firebase/auth';
import { deleteDoc, doc } from 'firebase/firestore';
import React, { createContext, useContext, useEffect, useState } from 'react';
import { auth, db } from '../firebase';
import { t } from '../i18n';
import { clearAccountStorage, clearAllStorage } from './accountStorage';
import { closeOperationalAccount } from '../backend/account';

type AuthState = {
  user: User | null;
  initializing: boolean;
  busy: boolean;
  error: string | null;
  signUp: (email: string, password: string, name?: string, mobile?: string) => Promise<void>;
  // True while the post-signup onboarding steps (code, role, ready) are on screen —
  // keeps the front-door overlay up even though Firebase already has a user.
  onboarding: boolean;
  setOnboarding: (b: boolean) => void;
  signIn: (email: string, password: string) => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  /**
   * Stops future operational work, deletes the profile and device data, and then deletes the
   * login. Records that need a retention policy remain server-side.
   * Requires a fresh credential from the account's linked Password, Apple, or Google
   * provider because Firebase refuses to delete an account whose sign-in is not recent.
   */
  /**
   * Set the name on this account.
   *
   * Sign-up takes a name but does not insist on one, and nothing anywhere could add one
   * afterwards — so an account created without one was stuck showing the local part of its
   * owner's email address wherever a name belonged, including to every traveler they drove.
   */
  setDisplayName: (name: string) => Promise<void>;
  deleteAccount: (reauthenticate: () => Promise<void>) => Promise<void>;
  signOut: () => Promise<void>;
};

const Ctx = createContext<AuthState | null>(null);

export function useAuth(): AuthState {
  const c = useContext(Ctx);
  if (!c) throw new Error('useAuth must be used inside <AuthProvider>');
  return c;
}

// Turn Firebase's error codes into plain, friendly language.
function friendly(code: string): string {
  switch (code) {
    case 'auth/email-already-in-use':
      return t('traveler.errEmailInUse');
    case 'auth/invalid-email':
      return "That doesn't look like a valid email.";
    case 'auth/weak-password':
      return t('traveler.errWeakPassword');
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return t('traveler.errBadCredentials');
    case 'auth/network-request-failed':
      return t('traveler.errNetwork');
    default:
      return t('traveler.errGeneric');
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [initializing, setInitializing] = useState(true);
  const [busy, setBusy] = useState(false);
  const [onboarding, setOnboarding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    return onAuthStateChanged(auth, (u) => {
      setUser(u);
      setInitializing(false);
    });
  }, []);

  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (e: any) {
      setError(friendly(e?.code ?? ''));
    } finally {
      setBusy(false);
    }
  };

  // Destructive flows must report failure to their caller. The ordinary sign-in helper stores
  // an error for the front-door screen and resolves; account deletion has its own confirmation
  // screen, whose try/catch must know whether any step failed before it dismisses itself.
  const runStrict = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (e: any) {
      setError(friendly(e?.code ?? ''));
      throw e;
    } finally {
      setBusy(false);
    }
  };

  const value: AuthState = {
    user,
    initializing,
    busy,
    error,
    signUp: (email, password, name, mobile) =>
      run(async () => {
        const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
        if (name) await updateProfile(cred.user, { displayName: name.trim() });
        // THE VERIFICATION EMAIL WAS NEVER SENT, so `emailVerified` was false on every
        // email-and-password account that has ever existed — and the server, which carries the
        // flag on every request, checked it nowhere. A free control, plumbed end to end, and
        // switched on at neither end.
        //
        // IT IS WHAT ACTUALLY ANSWERS "hundreds of accounts annoying the platform", and it
        // costs nothing. Google and Apple sign-in arrive verified already; only this path did
        // not. Failing to send is not failing to sign up: the account exists, the traveler is
        // in, and the gates that need a verified address say so when they are reached.
        try {
          const { sendEmailVerification } = await import('firebase/auth');
          await sendEmailVerification(cred.user);
        } catch {
          // Firebase rate-limits these; a refusal here must not cost somebody their account.
        }
        // The traveler's profile record — name and mobile live in Firestore, not the repo.
        try {
          const { doc, setDoc } = await import('firebase/firestore');
          const { db } = await import('../firebase');
          await setDoc(
            doc(db, 'users', cred.user.uid),
            { name: name?.trim() || '', mobile: mobile?.trim() || '', email: email.trim() },
            { merge: true },
          );
        } catch {
          // profile write is best-effort; the account itself is created
        }
      }),
    signIn: (email, password) =>
      run(() => signInWithEmailAndPassword(auth, email.trim(), password)),
    // The demo's sign-in screen offers "Forgot password?"; here it really sends the
    // reset email. Firebase deliberately succeeds even for unknown addresses, so the
    // screen's confirmation never reveals whether an account exists.
    resetPassword: (email) => run(() => sendPasswordResetEmail(auth, email.trim())),
    setDisplayName: (name) =>
      run(async () => {
        const u = auth.currentUser;
        if (!u) throw new Error(t('traveler.errNoAccount'));
        const clean = name.trim().slice(0, 40);
        if (!clean) throw new Error(t('traveler.errNameRequired'));
        await updateProfile(u, { displayName: clean });
        // React does not re-render on a Firebase profile change — the user object is the
        // same instance — so the new name is published deliberately.
        setUser({ ...u, displayName: clean } as User);
      }),
    deleteAccount: (reauthenticate) =>
      runStrict(async () => {
        const u = auth.currentUser;
        if (!u) throw new Error(t('traveler.errNoAccountDelete'));
        // 1. Use the credential provider already linked to this account. Cancellation and a
        // failed credential both throw, so no operational or destructive step can follow.
        await reauthenticate();
        if (auth.currentUser?.uid !== u.uid) throw new Error(t('traveler.errNoAccountDelete'));
        // 2. Stop future work before removing the login. Fail closed: deleting the login
        // while a scheduled Travel or an on-duty Operator remains could dispatch or charge
        // an account that can no longer control that work.
        await closeOperationalAccount();
        // 3. Their profile document (name, mobile, email). Transport, payment, safety and
        // qualification records are not deleted from the phone; their retention needs a
        // separate policy and privileged server handling.
        try {
          await deleteDoc(doc(db, 'users', u.uid));
        } catch {
          // same
        }
        // 4. Everything this app kept on the phone — role, operator qualification,
        //    revenue, preferences, trusted contacts, the welcome flag.
        await clearAllStorage();
        // 5. The login itself. After this the app returns to the front door.
        await deleteUser(u);
      }),
    // THE DEVICE IS CLEARED BEFORE THE SESSION ENDS. Firebase sign-out alone left every
    // `ar:` value on the phone for the next person who signed in — see accountStorage.ts.
    signOut: () =>
      run(async () => {
        await clearAccountStorage();
        await fbSignOut(auth);
      }),
    onboarding,
    setOnboarding,
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
