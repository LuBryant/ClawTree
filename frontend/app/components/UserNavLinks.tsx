'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { userIa } from '../lib/public-data';
import { useLanguage } from '../i18n/LanguageProvider';

const englishLabels: Record<string, string> = {
  '/user': 'Overview', '/user/signals': 'Signals', '/user/recaps': 'Recaps',
  '/user/events': 'Events', '/user/about': 'About', '/user/cooperate': 'Partner with us',
};

export default function UserNavLinks() {
  const pathname = usePathname();
  const { language, tx } = useLanguage();

  return (
    <nav className="mb-8 flex gap-2 overflow-x-auto pb-2" aria-label={tx('用户端导航', 'Public portal navigation')}>
      {userIa.map((item) => {
        const active = item.href === '/user'
          ? pathname === '/user'
          : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`btn-outline btn-sm whitespace-nowrap${active ? ' active' : ''}`}
            style={active ? { borderColor: 'var(--success)', color: 'var(--success)' } : undefined}
          >
            {language === 'zh' ? item.label : (englishLabels[item.href] || item.label)}
          </Link>
        );
      })}
    </nav>
  );
}
