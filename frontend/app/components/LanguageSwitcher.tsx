'use client';

import { useLanguage } from '../i18n/LanguageProvider';

export default function LanguageSwitcher() {
  const { language, setLanguage, tx } = useLanguage();

  return (
    <div className="language-switcher" role="group" aria-label={tx('语言切换', 'Language selector')}>
      <button type="button" className={language === 'zh' ? 'active' : undefined}
        onClick={() => setLanguage('zh')} aria-pressed={language === 'zh'}>
        中
      </button>
      <span aria-hidden="true">/</span>
      <button type="button" className={language === 'en' ? 'active' : undefined}
        onClick={() => setLanguage('en')} aria-pressed={language === 'en'}>
        EN
      </button>
    </div>
  );
}
