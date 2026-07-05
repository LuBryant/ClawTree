'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { publicRecaps } from '../../lib/public-data';
import { useLanguage } from '../../i18n/LanguageProvider';

const PS = 12;

const RISK_LABEL: Record<string, string> = {
  low: '低风险',
  medium: '需人审',
  high: '高风险边界',
};

const RISK_LABEL_EN: Record<string, string> = {
  low: 'Low risk',
  medium: 'Human review',
  high: 'High-risk boundary',
};

function riskBadgeClass(risk: string) {
  if (risk === 'high') return 'badge badge-warning';
  if (risk === 'medium') return 'badge';
  return 'badge badge-success';
}

export default function UserRecapsPage() {
  const { language, tx } = useLanguage();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [activeRisk, setActiveRisk] = useState<'all' | 'low' | 'medium' | 'high'>('all');

  const sorted = useMemo(
    () => [...publicRecaps].sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()),
    [],
  );

  const stats = useMemo(() => ({
    total: sorted.length,
    approved: sorted.filter((item) => item.editorialStatus === 'approved_fixture').length,
    highRisk: sorted.filter((item) => item.riskLevel === 'high').length,
  }), [sorted]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return sorted.filter((recap) => {
      const matchesRisk = activeRisk === 'all' || recap.riskLevel === activeRisk;
      const haystack = [
        recap.title,
        recap.summary,
        recap.takeaway,
        recap.useCase,
        recap.boundary,
        ...recap.tags,
        ...recap.highlights,
      ].join(' ').toLowerCase();
      return matchesRisk && (!q || haystack.includes(q));
    });
  }, [activeRisk, search, sorted]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PS));
  const paged = filtered.slice((page - 1) * PS, page * PS);

  const setRisk = (risk: 'all' | 'low' | 'medium' | 'high') => {
    setActiveRisk(risk);
    setPage(1);
  };

  return (
    <div className="flex flex-col gap-6">
      <section className="panel p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <span className="badge badge-success">Content Relay</span>
            <h2 className="mt-4 text-3xl font-black tracking-tight">
              {tx('大树活动回顾', 'TreeFinance Event Recaps')}
            </h2>
            <p className="mt-3 max-w-3xl text-sm leading-6" style={{ color: 'var(--muted)' }}>
              {tx(
                '这里展示已经过公开边界处理的活动复盘：保留来源、时间、AI 摘要、编辑说明和风险边界，方便高校老师、合作伙伴和评委理解 ClawTree 如何把公开信号变成可信合作资产。',
                'This page shows public-boundary event recaps: source links, timestamps, AI summaries, editorial notes, and risk boundaries, so educators, partners, and judges can see how ClawTree turns public signals into trusted collaboration assets.',
              )}
            </p>
          </div>
          <div className="grid grid-cols-3 gap-3 text-center sm:min-w-[360px]">
            <Metric label={tx('公开回顾', 'Public recaps')} value={stats.total} />
            <Metric label={tx('已审核', 'Reviewed')} value={stats.approved} />
            <Metric label={tx('高风险隔离', 'Guarded')} value={stats.highRisk} />
          </div>
        </div>
      </section>

      <section className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-wrap gap-2">
          {(['all', 'low', 'medium', 'high'] as const).map((risk) => (
            <button
              key={risk}
              type="button"
              className={activeRisk === risk ? 'btn btn-success btn-sm' : 'btn-outline btn-sm'}
              onClick={() => setRisk(risk)}
            >
              {risk === 'all'
                ? tx('全部', 'All')
                : (language === 'zh' ? RISK_LABEL[risk] : RISK_LABEL_EN[risk])}
            </button>
          ))}
        </div>
        <input
          type="text"
          value={search}
          onChange={(event) => { setSearch(event.target.value); setPage(1); }}
          placeholder={tx('搜索主题、城市、场景…', 'Search topic, city, use case…')}
          className="input-field w-full md:w-80"
        />
      </section>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {paged.map((recap) => (
          <article
            key={recap.id}
            className="event-card flex h-full flex-col"
            style={{ border: '1px solid var(--line)', background: 'var(--panel)', boxShadow: '0 18px 60px rgba(0,0,0,0.22)', padding: '18px' }}
          >
            <div className="flex flex-wrap items-center gap-2">
              <span className={riskBadgeClass(recap.riskLevel)}>
                {language === 'zh' ? RISK_LABEL[recap.riskLevel] : RISK_LABEL_EN[recap.riskLevel]}
              </span>
              <span className="badge">{recap.editorialStatus}</span>
            </div>

            <p className="mt-4 text-xs font-black uppercase tracking-wider" style={{ color: 'var(--muted)' }}>
              {recap.publishedDate} · {recap.useCase}
            </p>
            <h3 className="mt-2 text-lg font-black leading-snug">
              <Link href={'/user/recaps/' + recap.slug} className="hover:underline">
                {recap.title}
              </Link>
            </h3>
            <p className="mt-3 text-sm leading-6" style={{ color: 'var(--text-dim)' }}>
              {recap.summary}
            </p>
            <div className="mt-4 border border-[var(--line)] p-3">
              <p className="text-xs font-black uppercase tracking-wider" style={{ color: 'var(--success)' }}>
                {tx('为什么重要', 'Why it matters')}
              </p>
              <p className="mt-2 text-sm leading-6" style={{ color: 'var(--muted)' }}>
                {recap.takeaway}
              </p>
            </div>
            <ul className="mt-4 grid gap-2 text-xs leading-5" style={{ color: 'var(--muted)' }}>
              {recap.highlights.map((item) => (
                <li key={item}>• {item}</li>
              ))}
            </ul>
            <div className="mt-4 flex flex-wrap gap-2">
              {recap.tags.slice(0, 4).map((tag) => <span key={tag} className="badge">{tag}</span>)}
            </div>
            <p className="mt-4 text-xs leading-5" style={{ color: recap.riskLevel === 'high' ? 'var(--warning)' : 'var(--muted)' }}>
              {recap.boundary}
            </p>
            <div className="mt-auto flex items-center justify-between gap-2 pt-5">
              <a href={recap.sourceUrl} target="_blank" rel="noreferrer" className="text-xs font-black hover:underline" style={{ color: 'var(--info)' }}>
                {tx('原始来源', 'Source')} ↗
              </a>
              <Link href={'/user/recaps/' + recap.slug} className="btn-outline btn-sm">
                {tx('查看复盘', 'Open recap')}
              </Link>
            </div>
          </article>
        ))}
        {paged.length === 0 && (
          <div className="col-span-full panel py-16 text-center" style={{ color: 'var(--muted)' }}>
            {tx('没有匹配的回顾内容，请换一个关键词或风险筛选。', 'No matching recaps. Try another keyword or risk filter.')}
          </div>
        )}
      </section>

      {totalPages > 1 && (
        <section className="flex items-center justify-center gap-2 py-4">
          <button className="btn-outline btn-sm" disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)} style={{ opacity: page <= 1 ? 0.3 : 1 }}>← {tx('上一页', 'Previous')}</button>
          <span className="text-sm font-black" style={{ color: 'var(--muted)' }}>{page} / {totalPages}</span>
          <button className="btn-outline btn-sm" disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)} style={{ opacity: page >= totalPages ? 0.3 : 1 }}>{tx('下一页', 'Next')} →</button>
        </section>
      )}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="border border-[var(--line)] p-3">
      <strong className="block text-2xl font-black" style={{ color: 'var(--success)' }}>{value}</strong>
      <span className="mt-1 block text-xs font-bold" style={{ color: 'var(--muted)' }}>{label}</span>
    </div>
  );
}
