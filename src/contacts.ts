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

export const CONTACTS_KEY = 'ar:trusted-contacts:v1';
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

/** Read the list, migrating the old names-only shape. Never throws. */
export async function loadContacts(): Promise<TrustedContact[]> {
  try {
    const raw = await AsyncStorage.getItem(CONTACTS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
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
  } catch {
    return [];
  }
}

/** Write the list back. Never throws — a failed save must not take the screen down. */
export async function saveContacts(next: TrustedContact[]): Promise<void> {
  try {
    await AsyncStorage.setItem(CONTACTS_KEY, JSON.stringify(next.slice(0, MAX_CONTACTS)));
  } catch {
    // Storage full or unavailable. The in-memory list still holds for this session.
  }
}
