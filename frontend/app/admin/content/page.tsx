'use client';

import { contentReviewQueue } from '../../lib/public-data';
import { useLanguage } from '../../i18n/LanguageProvider';

export default function AdminContentPage() {
  const { tx } = useLanguage();
  return (
    <div className="flex flex-col gap-6">
      <section>
        <h1 className="font-normal leading-none tracking-tight" style={{ fontSize: 'clamp(1.6rem, 3.5vw, 2.6rem)' }}>
          {tx('内容审核台', 'Content Review')}
        </h1>
        <p className="mt-2 text-sm" style={{ color: 'var(--muted)' }}>
          {tx('Content Relay 审核面：主题分类、跨源去重、风险标签、建议稿 diff 与人审发布状态。', 'Content Relay review for topic classification, cross-source deduplication, risk labels, suggested diffs, and human publishing status.')}
        </p>
      </section>

      <section className="grid gap-4">
        {contentReviewQueue.map((item) => (
          <article key={item.id} className="panel p-5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="badge badge-success">{item.editorialStatus}</span>
              <span className={item.riskLevel === 'high' ? 'badge badge-warning' : 'badge'}>risk: {item.riskLevel}</span>
              <span className="badge">cluster: {item.clusterKey}</span>
            </div>
            <div className="mt-4 grid gap-5 lg:grid-cols-[1.1fr_.9fr]">
              <div>
                <h2 className="text-xl font-black">{item.title}</h2>
                <p className="mt-3 text-sm leading-7" style={{ color: 'var(--text-dim)' }}>{item.summary}</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {item.tags.map((tag) => <span key={tag} className="badge">{tag}</span>)}
                </div>
              </div>
              <div className="grid gap-3 text-sm">
                <div className="panel-deep p-3">
                  <strong>{tx('去重理由', 'Deduplication rationale')}</strong>
                  <p className="mt-2 leading-6" style={{ color: 'var(--muted)' }}>{item.duplicateReason}</p>
                </div>
                <div className="panel-deep p-3">
                  <strong>{tx('Diff 摘要', 'Diff summary')}</strong>
                  <p className="mt-2 leading-6" style={{ color: 'var(--muted)' }}>{item.diffSummary}</p>
                </div>
                <div className="flex gap-2">
                  <button className="btn btn-success btn-sm" type="button">{tx('批准发布', 'Approve')}</button>
                  <button className="btn-outline btn-sm" type="button">{tx('退回修改', 'Request changes')}</button>
                </div>
              </div>
            </div>
          </article>
        ))}
      </section>
    </div>
  );
}
