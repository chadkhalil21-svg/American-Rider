// Trusted contacts — the up-to-three people who can be told where a traveler is.
//
// WHY THIS FILE EXISTS: the list used to be `string[]` — names only. Safe Travels then
// offered "Add a contact" and stored, say, "Ana". A name is not a way of reaching anyone,
// so the emergency screen could not have messaged a single one of them. Storing a number
// alongside the name is what turns "trusted contacts" from a label into a mechanism.
//
// The old shape is migrated in place rather than discarded: someone who added three names
// keeps all three, they simply have no number until one is added.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db } from './firebase';

const CONTACTS_KEY_PREFIX = 'ar:trusted-contacts:v2:';
const contactsKey = () => CONTACTS_KEY_PREFIX + (auth.currentUser?.uid || 'preview');
export const MAX_CONTACTS = 3;

export type TrustedContact = {
  name: string;
  /** Undefined for contacts added before numbers were stored, or deliberately left blank. */
  phone?: string;
};

/** Digits and a leading +, which is all a `sms:` or `tel:` URL can carry. */
export function normalizePhone(raw: string): string {
  const trimmed = (raw || '').trim();
  if (!trimmed) return '';
  const plus = trimmed.startsWith('+') ? '+' : '';
  return plus + trimmed.replace(/[^\d]/g, '');
}

/** US-style grouping for display. Anything that isn't 10 digits is shown as entered. */
export function prettyPhone(raw?: string): string {
  const n = normalizePhone(raw || '');
  const digits = n.startsWith('+') ? n.slice(1) : n;
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  if (digits.length === 11 && digits.startsWith('1')) {
    return `(${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
  }
  return raw || '';
}

function normalizeContacts(parsed: unknown): TrustedContact[] {
  if (!Array.isArray(parsed)) return [];
  return parsed
    .map((c: unknown): TrustedContact | null => {
      if (typeof c === 'string') return c.trim() ? { name: c.trim() } : null;
      if (c && typeof c === 'object') {
        const name = String((c as TrustedContact).name ?? '').trim();
        const phone = normalizePhone(String((c as TrustedContact).phone ?? ''));
        return name ? { name, ...(phone ? { phone } : {}) } : null;
      }
      return null;
    })
    .filter((c): c is TrustedContact => c !== null)
    .slice(0, MAX_CONTACTS);
}

/** Read the list, migrating the old names-only shape. Never throws. */
export async function loadContacts(): Promise<TrustedContact[]> {
  let local: TrustedContact[] = [];
  try {
    const raw = await AsyncStorage.getItem(contactsKey());
    local = raw ? normalizeContacts(JSON.parse(raw)) : [];
  } catch {
    local = [];
  }

  const uid = auth.currentUser?.uid;
  if (!uid) return local;

  try {
    const snap = await getDoc(doc(db, 'users', uid));
    const remote = snap.exists() ? normalizeContacts(snap.data()?.trustedContacts) : [];
    if (snap.exists() && Array.isArray(snap.data()?.trustedContacts)) {
      await AsyncStorage.setItem(contactsKey(), JSON.stringify(remote)).catch(() => {});
      return remote;
    }

    // One-time migration from the earlier device-only model.
    if (local.length) {
      await setDoc(doc(db, 'users', uid), { trustedContacts: local }, { merge: true });
    }
  } catch {
    // Offline or rules unavailable: the account-scoped local cache remains usable.
  }

  return local;
}

/** Write the list back. Never throws — a failed save must not take the screen down. */
export async function saveContacts(next: TrustedContact[]): Promise<void> {
  const clean = normalizeContacts(next);
  try {
    await AsyncStorage.setItem(contactsKey(), JSON.stringify(clean));
  } catch {
    // Storage full or unavailable. The in-memory list still holds for this session.
  }
  const uid = auth.currentUser?.uid;
  if (uid) {
    try {
      await setDoc(doc(db, 'users', uid), { trustedContacts: clean }, { merge: true });
    } catch {
      // The local account cache remains usable offline; a later load can retry migration.
    }
  }
}
