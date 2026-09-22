// Dates and times as the traveler reads them: in their language, with the year, so a record
// from another year cannot be mistaken for this one. Screens that print a travel's date go
// through here; each used to call toLocaleDateString('en-US') on its own, so a Spanish reader
// saw "Aug 9" beside Spanish prose.
import type { LanguageCode } from './i18n';

/** "August 9, 2026 · 9:22 PM" — a travel's date and time, in the traveler's language. */
export function travelDateTime(at: number | string, language: LanguageCode): string {
  const d = new Date(at);
  const day = d.toLocaleDateString(language, { year: 'numeric', month: 'long', day: 'numeric' });
  const time = d.toLocaleTimeString(language, { hour: 'numeric', minute: '2-digit' });
  return `${day} · ${time}`;
}

/** "August 9, 2026" — a date alone, where the time is not the point. */
export function travelDate(at: number | string, language: LanguageCode): string {
  return new Date(at).toLocaleDateString(language, { year: 'numeric', month: 'long', day: 'numeric' });
}

/** "Aug 9" — the short form for a row whose year is not in question. */
export function travelDateShort(at: number | string, language: LanguageCode): string {
  return new Date(at).toLocaleDateString(language, { month: 'short', day: 'numeric' });
}
