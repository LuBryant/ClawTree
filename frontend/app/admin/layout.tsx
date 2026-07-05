'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useLanguage } from '../i18n/LanguageProvider';
import { DEMO_WORKSPACE } from '../config/workspaces';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { tx } = useLanguage();
  const links = [
    { href: '/admin', label: '📊 Dashboard', exact: true },
    { href: '/admin/events', label: `📅 ${tx('活动浏览器', 'Event browser')}`, exact: false },
    { href: '/admin/reviews', label: `📸 ${tx('活动回顾', 'Event recaps')}`, exact: false },
    { href: '/admin/ingestion', label: `🛰 ${tx('采集运行', 'Ingestion runs')}`, exact: false },
    { href: '/admin/content', label: `📝 ${tx('内容审核', 'Content review')}`, exact: false },
    { href: '/admin/proposals', label: `🤝 ${tx('合作提案', 'Proposals')}`, exact: false },
    { href: '/admin/outreach', label: `✉️ ${tx('外联审批', 'Outreach review')}`, exact: false },
  ];

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-1 gap-8 px-6 py-10">
      <aside className="hidden w-52 shrink-0 lg:block">
        <div className="sticky top-20 flex flex-col gap-1">
          <p className="mb-1 text-xs font-black uppercase tracking-widest" style={{ color: 'var(--warning)' }}>{tx('当前工作区', 'Active workspace')}</p>
          <div className="mb-5 border border-[var(--line)] p-3">
            <strong className="block text-sm">{tx(DEMO_WORKSPACE.name, DEMO_WORKSPACE.nameEn)}</strong>
            <span className="mt-1 block text-[10px] uppercase tracking-wider" style={{ color: 'var(--success)' }}>Demo case · {DEMO_WORKSPACE.initials}</span>
          </div>
          {links.map(({ href, label, exact }) => {
            const active = exact ? pathname === href : pathname.startsWith(href);
            return (
              <Link key={href} href={href}
                className={`admin-link ${active ? 'active' : ''}`}
              >
                {label}
              </Link>
            );
          })}
        </div>
      </aside>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
