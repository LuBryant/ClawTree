'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const links = [
  { href: '/admin', label: '📊 Dashboard', exact: true },
  { href: '/admin/events', label: '📅 活动浏览器', exact: false },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-1 gap-8 px-6 py-10">
      <aside className="hidden w-52 shrink-0 lg:block">
        <div className="sticky top-20 flex flex-col gap-1">
          <p className="mb-3 text-xs font-black uppercase tracking-widest" style={{ color: 'var(--warning)' }}>
            管理端
          </p>
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
