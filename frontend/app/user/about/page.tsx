'use client';

import { capabilityLibrary, publicRecaps } from '../../lib/public-data';
import { useLanguage } from '../../i18n/LanguageProvider';
import { DEMO_WORKSPACE } from '../../config/workspaces';

export default function UserAboutPage() {
  const { tx } = useLanguage();
  return (
    <div className="grid gap-5 lg:grid-cols-[.9fr_1.1fr]">
      <section className="panel p-6">
        <span className="badge badge-success">DEMO CASE · {DEMO_WORKSPACE.nameEn}</span>
        <h2 className="mt-5 text-3xl font-black tracking-tight">{tx(`${DEMO_WORKSPACE.name}能提供什么？`, `What can ${DEMO_WORKSPACE.nameEn} offer?`)}</h2>
        <p className="mt-4 text-sm leading-7" style={{ color: 'var(--text-dim)' }}>
          {tx('当前公开能力库只包含已审核、可引用、带有效期的能力条目。AI 客服和合作提案只能引用这些条目，不能承诺未批准的奖金、嘉宾、曝光、投资或主办身份。', 'The public capability library contains only reviewed, citable, time-bounded entries. AI support and proposals may cite only these entries and cannot promise unapproved prizes, guests, exposure, investment, or host status.')}
        </p>
        <div className="mt-6 grid gap-3">
          {publicRecaps.slice(0, 3).map((recap) => (
            <div key={recap.id} className="border border-[var(--line)] p-3">
              <strong className="block text-sm">{recap.title}</strong>
              <span className="mt-1 block text-xs" style={{ color: 'var(--muted)' }}>{tx('来源样本', 'Source sample')} · {recap.publishedDate}</span>
            </div>
          ))}
        </div>
      </section>
      <section className="grid gap-4">
        {capabilityLibrary.map((capability) => (
          <article key={capability.id} className="panel p-5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="badge badge-success">approved</span>
              <span className="badge">valid until {capability.validUntil}</span>
            </div>
            <h3 className="mt-4 text-xl font-black">{tx(capability.title, capability.titleEn)}</h3>
            <p className="mt-3 text-sm leading-7" style={{ color: 'var(--text-dim)' }}>{tx(capability.boundary, capability.boundaryEn)}</p>
            <p className="mt-4 text-xs" style={{ color: 'var(--muted)' }}>
              Owner: {capability.owner} · {tx('引用', 'Citations')}: {capability.sourceIds.join(', ')}
            </p>
          </article>
        ))}
      </section>
    </div>
  );
}
