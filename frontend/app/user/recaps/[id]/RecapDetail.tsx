'use client';

import Link from 'next/link';
import { publicRecaps } from '../../../lib/public-data';
import { useLanguage } from '../../../i18n/LanguageProvider';

export default function RecapDetail({ recap }: { recap: (typeof publicRecaps)[number] }) {
  const { tx } = useLanguage();

  return (
    <article className="mx-auto max-w-3xl panel p-6">
      <Link href="/user/recaps" className="text-sm font-black" style={{ color: 'var(--info)' }}>← {tx('返回回顾列表', 'Back to recaps')}</Link>
      <div className="mt-6 flex flex-wrap gap-2">
        <span className="badge badge-success">{recap.editorialStatus}</span>
        <span className={recap.riskLevel === 'high' ? 'badge badge-warning' : 'badge'}>risk: {recap.riskLevel}</span>
        {recap.tags.map((tag) => <span key={tag} className="badge">{tag}</span>)}
      </div>
      <h2 className="mt-6 text-3xl font-black leading-tight tracking-tight">{recap.title}</h2>
      <p className="mt-5 text-base leading-8" style={{ color: 'var(--text-dim)' }}>{recap.summary}</p>
      <section className="mt-6 grid gap-4 md:grid-cols-2">
        <div className="border border-[var(--line)] p-4">
          <p className="text-xs font-black uppercase tracking-wider" style={{ color: 'var(--success)' }}>
            {tx('为什么重要', 'Why it matters')}
          </p>
          <p className="mt-3 text-sm leading-7" style={{ color: 'var(--text-dim)' }}>{recap.takeaway}</p>
        </div>
        <div className="border border-[var(--line)] p-4">
          <p className="text-xs font-black uppercase tracking-wider" style={{ color: 'var(--info)' }}>
            {tx('可用于', 'Useful for')}
          </p>
          <p className="mt-3 text-sm leading-7" style={{ color: 'var(--text-dim)' }}>{recap.useCase}</p>
          <ul className="mt-3 grid gap-2 text-xs leading-5" style={{ color: 'var(--muted)' }}>
            {recap.highlights.map((item) => <li key={item}>• {item}</li>)}
          </ul>
        </div>
      </section>
      <section className="mt-6 grid gap-3 border border-[var(--line)] p-4 text-sm" style={{ color: 'var(--muted)' }}>
        <p>{tx('原发布时间', 'Originally published')}: {recap.publishedDate}</p>
        <p>{tx('本站抓取/核验', 'Captured / verified')}: {recap.fetchedDate}</p>
        <p>{tx('编辑说明', 'Editorial note')}: {recap.editorNote}</p>
        <p>{tx('风险边界', 'Risk boundary')}: {recap.boundary}</p>
        <p>{tx('公开边界：无授权媒体不复制展示；AI 建议不覆盖原文；真实发布必须人审。', 'Public boundary: unlicensed media is not republished; AI suggestions never overwrite source text; real publication requires human review.')}</p>
      </section>
      <a href={recap.sourceUrl} target="_blank" rel="noreferrer" className="mt-6 inline-flex btn-outline">
        {tx('查看原始来源', 'View original source')} ↗
      </a>
    </article>
  );
}
