// LANGUAGE. Not a feature — a condition of the market we are launching into.
//
// Miami-Dade is roughly two-thirds Hispanic, and the operators Chad is actually meeting speak
// Spanish. An English-only app does not merely inconvenience them; it selects against them.
// Chad's instruction (4 Sept 2026) is that travelers choose their language too, so this is not
// an operator-recruiting tool bolted on the side — it is how both apps address anybody.
//
// WHY A CATALOGUE RATHER THAN INLINE STRINGS. Every user-visible string in this codebase was
// written directly into JSX. That is fine until the second language, at which point it becomes
// the reason the second language never ships. The catalogue is the one place a translator —
// human or otherwise — can be given the whole surface without reading React.
//
// THE ENGLISH IS THE SOURCE, AND FOR THE LEGAL DOCUMENTS IT IS ALSO CONTROLLING. A translated
// insurance disclosure that says something the English does not is worse than no translation:
// §627.748(8)(a) requires the disclosure be MADE, and a mistranslation is a defect in the
// making of it. Translations of Terms, Privacy, the disclosure and the operator agreement are
// offered for comprehension; the English governs, and that is stated on those documents.
import { getLocales } from 'expo-localization';
import { I18n } from 'i18n-js';

import de from './de';
import en from './en';
import es from './es';
import fr from './fr';
import it from './it';

export const LANGUAGES = [
  { code: 'en', label: 'English' },
  // Endonyms, not English names for other people's languages. A Spanish speaker looking for
  // their language is looking for "Español".
  { code: 'es', label: 'Español' },
  { code: 'fr', label: 'Français' },
  { code: 'it', label: 'Italiano' },
  { code: 'de', label: 'Deutsch' },
] as const;

export type LanguageCode = (typeof LANGUAGES)[number]['code'];

export const i18n = new I18n({ en, es, fr, it, de });

// FALL BACK TO ENGLISH RATHER THAN SHOW A KEY. A missing translation renders the English
// sentence, which is readable; the alternative is `operator.commence` appearing on a button.
i18n.enableFallback = true;
i18n.defaultLocale = 'en';

/** The device's language if we speak it, else English. Overridden by an explicit choice. */
export function deviceLanguage(): LanguageCode {
  const tag = getLocales()[0]?.languageCode ?? 'en';
  return (LANGUAGES.find((l) => l.code === tag)?.code ?? 'en') as LanguageCode;
}

export function setLanguage(code: LanguageCode) {
  i18n.locale = code;
}

/** Translate. `t('operator.commence')` — see src/i18n/en.ts for the whole surface. */
export const t = (key: string, params?: Record<string, unknown>) => i18n.t(key, params);
