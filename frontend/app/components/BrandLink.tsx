'use client';

import Link from 'next/link';
import { useLanguage } from '../i18n/LanguageProvider';

export default function BrandLink() {
  const { tx } = useLanguage();

  return (
    <Link href="/" className="brand" aria-label={tx('ClawTree 首页', 'ClawTree home')}>
      <span className="brand-mark">CT</span>
      <span>ClawTree <small>{tx('树爪智动', 'AI Growth OS')}</small></span>
    </Link>
  );
}
