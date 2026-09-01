import { createContext, PropsWithChildren, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import {
  Dictionary,
  Language,
  dictionaryFor,
  deviceLanguage,
  loadLanguage,
  localeTag,
  saveLanguage,
} from '@/i18n';

type LanguageContextValue = {
  language: Language;
  /** Dictionary for the active language. */
  t: Dictionary;
  locale: string;
  ready: boolean;
  setLanguage: (language: Language) => Promise<void>;
};

const LanguageContext = createContext<LanguageContextValue | null>(null);

export function LanguageProvider({ children }: PropsWithChildren) {
  // Start from the device so the very first frame is already in the right
  // language; the stored override replaces it once storage has answered.
  const [language, setLanguageState] = useState<Language>(deviceLanguage);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let active = true;
    void loadLanguage().then((stored) => {
      if (!active) return;
      setLanguageState(stored);
      setReady(true);
    });
    return () => {
      active = false;
    };
  }, []);

  const setLanguage = useCallback(async (next: Language) => {
    setLanguageState(next);
    await saveLanguage(next);
  }, []);

  const value = useMemo<LanguageContextValue>(() => ({
    language,
    t: dictionaryFor(language),
    locale: localeTag(language),
    ready,
    setLanguage,
  }), [language, ready, setLanguage]);

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const value = useContext(LanguageContext);
  if (!value) throw new Error('useLanguage must be used inside LanguageProvider');
  return value;
}
