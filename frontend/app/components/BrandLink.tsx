'use client';

import Link from 'next/link';
import { useLanguage } from '../i18n/LanguageProvider';
import { PLATFORM_PROFILE } from '../config/workspaces';

export default function BrandLink() {
  const { tx } = useLanguage();

  return (
    <Link href="/" className="brand" aria-label={tx('ClawTree 首页', 'ClawTree home')}>
      <span className="brand-mark">CT</span>
      <span>{PLATFORM_PROFILE.name} <small>{tx(PLATFORM_PROFILE.categoryZh, 'PARTNERSHIP OS')}</small></span>
    </Link>
  );
}
