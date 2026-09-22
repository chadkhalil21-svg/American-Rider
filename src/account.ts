// How the signed-in account is named and initialed — ONE rule for the whole app.
//
// Transcribed from the web demo (traveler-institutional.html:151), which derives both
// from whatever name the traveler typed at sign-up:
//   RIDER.name = the name, verbatim (sanitized, trimmed, 40 chars)
//   RIDER.init = name.split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase()
// So "John Rider" → JR, and a single-word name like "chadkhalil21" → C (ONE letter,
// not two — the demo takes one initial per word, never two from one word).
//
// ⚠️ Every screen must use these. Before this file existed the derivation was copied
// five different ways and the drawer, profile, and ride screens disagreed with each
// other — exactly the drift the pre-ship gate exists to catch.

type AccountLike = { displayName?: string | null; email?: string | null } | null | undefined;

/** The account's name: their sign-up name if set, else the email's local part. Verbatim. */
export function accountName(user: AccountLike, fallback = 'Traveler'): string {
  const dn = user?.displayName?.trim();
  if (dn) return dn.slice(0, 40);
  const local = user?.email?.split('@')[0]?.trim();
  return local || fallback;
}

/** The avatar's letters: one initial per word, at most two — the demo's exact rule. */
export function accountInitials(user: AccountLike, fallback = 'AR'): string {
  const name = accountName(user, '');
  if (!name) return fallback;
  const letters = name
    .split(/\s+/)
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('');
  return letters ? letters.toUpperCase() : fallback;
}
