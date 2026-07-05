'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

export type Language = 'zh' | 'en';

interface LanguageContextValue {
  language: Language;
  locale: 'zh-CN' | 'en-US';
  setLanguage: (language: Language) => void;
  toggleLanguage: () => void;
  tx: (zh: string, en: string) => string;
}

const STORAGE_KEY = 'clawtree-language';
const LanguageContext = createContext<LanguageContextValue | null>(null);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<Language>('zh');

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved === 'zh' || saved === 'en') setLanguageState(saved);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    document.documentElement.lang = language === 'zh' ? 'zh-CN' : 'en';
    document.documentElement.dataset.language = language;
  }, [language]);

  const setLanguage = useCallback((nextLanguage: Language) => {
    setLanguageState(nextLanguage);
    window.localStorage.setItem(STORAGE_KEY, nextLanguage);
  }, []);

  const toggleLanguage = useCallback(() => {
    setLanguageState((current) => {
      const nextLanguage = current === 'zh' ? 'en' : 'zh';
      window.localStorage.setItem(STORAGE_KEY, nextLanguage);
      return nextLanguage;
    });
  }, []);

  const value = useMemo<LanguageContextValue>(() => ({
    language,
    locale: language === 'zh' ? 'zh-CN' : 'en-US',
    setLanguage,
    toggleLanguage,
    tx: (zh, en) => language === 'zh' ? zh : en,
  }), [language, setLanguage, toggleLanguage]);

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) throw new Error('useLanguage must be used within LanguageProvider');
  return context;
}
