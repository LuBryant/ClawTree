'use client';

import Link from 'next/link';
import UserNavLinks from '../components/UserNavLinks';
import { useLanguage } from '../i18n/LanguageProvider';

export default function UserLayout({ children }: { children: React.ReactNode }) {
  const { tx } = useLanguage();
  return (
    <main className="shell section-block">
      <div className="mb-8 flex flex-col gap-4 border border-[var(--line)] bg-[rgba(12,17,27,.82)] p-4 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="eyebrow">PUBLIC PORTAL / APPROVED ONLY</p>
          <h1 className="mt-2 text-2xl font-black tracking-tight md:text-4xl">{tx('ClawTree 用户端', 'ClawTree Public Portal')}</h1>
          <p className="mt-2 max-w-2xl text-sm leading-7" style={{ color: 'var(--muted)' }}>
            {tx('给高校老师、学生和合作方看的可信内容入口；公开端不展示联系邮箱、内部评分、风险原文、模型 prompt 或回复内容。', 'A trusted content hub for educators, students, and partners. Contact emails, internal scores, raw risk text, model prompts, and replies are never exposed here.')}
          </p>
        </div>
        <Link href="/admin" className="btn-outline whitespace-nowrap">{tx('切到运营端', 'Open Operations')} →</Link>
      </div>
      <UserNavLinks />
      {children}
    </main>
  );
}
