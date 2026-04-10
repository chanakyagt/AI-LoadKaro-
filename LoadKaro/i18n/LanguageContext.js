import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';

import en from './en';
import hi from './hi';
import te from './te';
import kn from './kn';

const STORAGE_KEY = 'loadkaro_language';

const LANGUAGES = {
  en: { label: 'English', nativeLabel: 'English', translations: en },
  hi: { label: 'Hindi', nativeLabel: 'हिन्दी', translations: hi },
  te: { label: 'Telugu', nativeLabel: 'తెలుగు', translations: te },
  kn: { label: 'Kannada', nativeLabel: 'ಕನ್ನಡ', translations: kn },
};

export const LANGUAGE_OPTIONS = Object.entries(LANGUAGES).map(([code, meta]) => ({
  code,
  label: meta.label,
  nativeLabel: meta.nativeLabel,
}));

const LanguageContext = createContext({
  language: 'en',
  t: (key) => key,
  setLanguage: async () => {},
});

export function LanguageProvider({ children }) {
  const [language, setLang] = useState('en');
  const [ready, setReady] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const saved = await AsyncStorage.getItem(STORAGE_KEY);
        if (saved && saved in LANGUAGES) {
          setLang(saved);
        }
      } catch {
        // use default
      }
      setReady(true);
    })();
  }, []);

  const setLanguage = useCallback(async (code) => {
    if (!(code in LANGUAGES)) return;
    setLang(code);
    try {
      await AsyncStorage.setItem(STORAGE_KEY, code);
    } catch {
      // silent
    }
  }, []);

  const t = useCallback(
    (key) => {
      const translations = LANGUAGES[language]?.translations;
      if (translations && key in translations) {
        return translations[key];
      }
      if (en[key]) return en[key];
      return key;
    },
    [language]
  );

  if (!ready) return null;

  return (
    <LanguageContext.Provider value={{ language, t, setLanguage }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useTranslation() {
  return useContext(LanguageContext);
}
