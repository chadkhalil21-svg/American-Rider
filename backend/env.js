// Reading secrets out of the environment, safely.
//
// WHY THIS EXISTS: pasting a key into a hosting dashboard very easily picks up a trailing
// newline, a stray space, or a pair of quotes. The key then LOOKS correct everywhere you
// inspect it, and startsWith('sk_test_') still passes — but the moment it is put into an
// HTTP Authorization header, Node refuses:
//
//   ERR_INVALID_CHAR: Invalid character in header content ["Authorization"]
//
// The Stripe SDK reports that as "An error occurred with our connection to Stripe", which
// sends you hunting for a network fault that does not exist. This cost us a real debugging
// session on 3 Aug 2026. Read every key through here so it cannot happen again.
function readKey(name) {
  const raw = process.env[name];
  if (typeof raw !== 'string') return '';
  // Strip a surrounding pair of quotes, then remove ALL whitespace — not just the ends.
  // A dashboard textarea can wrap a long key and inject a line break in the MIDDLE, which
  // trimming alone won't fix. No API key we use (sk_test_…, sk-ant-…) contains whitespace,
  // so removing it is always safe and makes a mangled paste self-heal.
  return raw.replace(/^\s*["']?|["']?\s*$/g, '').replace(/\s+/g, '');
}

// True if the value contains anything that cannot go in an HTTP header (control chars,
// or non-ASCII). Used to fail loudly and specifically rather than as a "connection error".
function hasInvalidHeaderChars(v) {
  return /[^\x20-\x7E]/.test(v);
}

// Describes WHICH characters are unusable, as position + unicode codepoint — e.g.
// "position 54: U+200B". Deliberately reveals no key material (no surrounding characters,
// no length beyond the position), but ends the guessing about what a bad paste contained.
function describeInvalidChars(v) {
  const bad = [];
  for (let i = 0; i < v.length; i++) {
    const c = v.codePointAt(i);
    if (c < 0x20 || c > 0x7e) {
      bad.push(`position ${i}: U+${c.toString(16).toUpperCase().padStart(4, '0')}`);
      if (bad.length >= 5) break;
    }
  }
  return bad;
}

module.exports = { readKey, hasInvalidHeaderChars, describeInvalidChars };
