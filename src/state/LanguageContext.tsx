// CHANGING LANGUAGE HAS TO RE-RENDER, and i18n-js alone does not do that.
//
// Setting i18n.locale mutates a module-level object. React has no idea it happened, so a
// traveler who picks Español watches the app stay in English until something unrelated
// re-renders — which reads as the setting not working, and is the sort of thing nobody
// reports because it looks like their own mistake.
//
// So the chosen language is STATE, held here, and the mutation is a side effect of setting it.
// Every screen that translates reads this context, which is what makes the change immediate
// and total rather than gradual and confusing.
import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { deviceLanguage, i18n, LANGUAGES, LanguageCode, t as translate } from '../i18n';

const KEY = 'ar:language';

type LanguageState = {
  language: LanguageCode;
  setLanguage: (code: LanguageCode) => void;
  /** Translate. Depends on `language`, so callers re-render when it changes. */
  t: (key: string, params?: Record<string, unknown>) => string;
  languages: typeof LANGUAGES;
};

const Ctx = createContext<LanguageState | null>(null);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  // THE DEVICE'S LANGUAGE IS THE OPENING GUESS, NOT THE ANSWER. A phone set to Spanish gets
  // Spanish on first launch without being asked, which is the whole point for an operator who
  // would otherwise meet an English sign-up form. An explicit choice always wins over it.
  const [language, setState] = useState<LanguageCode>(() => {
    i18n.locale = deviceLanguage();
    return i18n.locale as LanguageCode;
  });

  useEffect(() => {
    AsyncStorage.getItem(KEY)
      .then((saved) => {
        if (!saved || !LANGUAGES.some((l) => l.code === saved)) return;
        i18n.locale = saved;
        setState(saved as LanguageCode);
      })
      .catch(() => {});
  }, []);

  const setLanguage = useCallback((code: LanguageCode) => {
    i18n.locale = code;
    setState(code);
    AsyncStorage.setItem(KEY, code).catch(() => {});
  }, []);

  const value = useMemo<LanguageState>(
    () => ({
      language,
      setLanguage,
      // Rebuilt whenever `language` changes — that identity change is what re-renders the
      // screens holding it.
      t: (key, params) => translate(key, params),
      languages: LANGUAGES,
    }),
    [language, setLanguage],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useLanguage(): LanguageState {
  const v = useContext(Ctx);
  if (!v) throw new Error('useLanguage must be used inside LanguageProvider');
  return v;
}
