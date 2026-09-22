// Everything this app keeps on the phone for ONE account, and the one rule for clearing it.
//
// THE DEFECT THIS CLOSES. Signing out called Firebase and nothing else, so the previous
// account's operator qualification, revenue, trusted contacts, saved places, travel
// preferences and welcome flag stayed on the device — and the next person to sign in on that
// phone inherited them. During a test program two Operators share a handset routinely.
//
// `ar:language` is deliberately kept: it is a property of the person holding the phone, not
// of the account, and making somebody re-choose their language on every sign-out is unkind
// and reveals nothing about the account that left.
import AsyncStorage from '@react-native-async-storage/async-storage';

const PREFIX = 'ar:';
const KEPT_ACROSS_ACCOUNTS = ['ar:language'];

/** Remove every stored value belonging to the account that is leaving. Never throws. */
export async function clearAccountStorage(): Promise<void> {
  try {
    const keys = await AsyncStorage.getAllKeys();
    const ours = keys.filter((k) => k.startsWith(PREFIX) && !KEPT_ACROSS_ACCOUNTS.includes(k));
    if (ours.length) await AsyncStorage.multiRemove(ours);
  } catch {
    // A phone that cannot clear its own storage must still be able to sign out.
  }
}

/** Deleting an account takes the language too: nothing of that person remains. */
export async function clearAllStorage(): Promise<void> {
  try {
    const keys = await AsyncStorage.getAllKeys();
    const ours = keys.filter((k) => k.startsWith(PREFIX));
    if (ours.length) await AsyncStorage.multiRemove(ours);
  } catch {
    // same
  }
}
