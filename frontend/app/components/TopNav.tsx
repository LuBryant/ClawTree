'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import ConnectWallet from './ConnectWallet';
import LanguageSwitcher from './LanguageSwitcher';
import { useLanguage } from '../i18n/LanguageProvider';

export default function TopNav() {
  const pathname = usePathname();
  const { tx } = useLanguage();
  const links = [
    { href: '/', label: tx('首页', 'Home') },
    { href: '/user', label: tx('用户端', 'Public Portal') },
    { href: '/demo', label: tx('现场 Demo', 'Live Demo') },
    { href: '/admin', label: tx('运营台', 'Operations') },
  ];

  return (
    <nav className="top-nav" aria-label={tx('主导航', 'Main navigation')}>
      {links.map(({ href, label }) => {
        const active = href === '/admin'
          ? pathname.startsWith('/admin')
          : pathname === href;
        return (
          <Link
            key={href}
            href={href}
            style={active ? { color: 'var(--success)' } : undefined}
          >
            {label}
          </Link>
        );
      })}
      <LanguageSwitcher />
      <ConnectWallet />
    </nav>
  );
}
