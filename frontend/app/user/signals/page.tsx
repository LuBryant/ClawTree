'use client';

import { publicSignals } from '../../lib/public-data';
import { useLanguage } from '../../i18n/LanguageProvider';

export default function UserSignalsPage() {
  const { tx } = useLanguage();
  return (
    <div className="flex flex-col gap-5">
      <section>
        <h2 className="text-3xl font-black tracking-tight">{tx('校园与 AI/Web3 Signals', 'Campus and AI/Web3 Signals')}</h2>
        <p className="mt-2 text-sm" style={{ color: 'var(--muted)' }}>
          {tx('区分公开事实、AI 摘要和编辑边界；所有信号都保留来源和抓取时间。', 'Public facts, AI summaries, and editorial boundaries stay distinct. Every signal retains its source and capture time.')}
        </p>
      </section>
      <div className="grid gap-4 md:grid-cols-2">
        {publicSignals.map((signal) => (
          <article key={signal.id} className="panel p-5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="badge badge-success">{tx('事实', 'Fact')} · {signal.verification}</span>
              <span className="badge badge-info">{tx('AI 摘要', 'AI summary')}</span>
              <span className="badge">{signal.kind}</span>
            </div>
            <h3 className="mt-4 text-xl font-black">{signal.title}</h3>
            <p className="mt-3 text-sm leading-7" style={{ color: 'var(--text-dim)' }}>{signal.summary}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              {signal.tags.map((tag) => <span key={tag} className="badge">{tag}</span>)}
            </div>
            <div className="mt-5 grid gap-2 text-xs" style={{ color: 'var(--muted)' }}>
              <span>{tx('发布时间', 'Published')}: {signal.publishedDate}</span>
              <span>{tx('抓取/核验', 'Captured / verified')}: {signal.fetchedDate}</span>
              <span>{tx('边界', 'Boundary')}: {signal.boundary}</span>
            </div>
            <a href={signal.url} target="_blank" rel="noreferrer" className="mt-5 inline-flex text-sm font-black" style={{ color: 'var(--info)' }}>
              {tx('原始来源', 'Original source')} ↗
            </a>
          </article>
        ))}
      </div>
    </div>
  );
}
