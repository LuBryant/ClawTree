import { capabilityLibrary, publicRecaps } from '../../lib/public-data';

export default function UserAboutPage() {
  return (
    <div className="grid gap-5 lg:grid-cols-[.9fr_1.1fr]">
      <section className="panel p-6">
        <span className="badge badge-success">About TreeFinance</span>
        <h2 className="mt-5 text-3xl font-black tracking-tight">大树能提供什么？</h2>
        <p className="mt-4 text-sm leading-7" style={{ color: 'var(--text-dim)' }}>
          当前公开能力库只包含已审核、可引用、带有效期的能力条目。AI 客服和合作提案只能引用这些条目，
          不能承诺未批准的奖金、嘉宾、曝光、投资或主办身份。
        </p>
        <div className="mt-6 grid gap-3">
          {publicRecaps.slice(0, 3).map((recap) => (
            <div key={recap.id} className="border border-[var(--line)] p-3">
              <strong className="block text-sm">{recap.title}</strong>
              <span className="mt-1 block text-xs" style={{ color: 'var(--muted)' }}>来源样本 · {recap.publishedDate}</span>
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
            <h3 className="mt-4 text-xl font-black">{capability.title}</h3>
            <p className="mt-3 text-sm leading-7" style={{ color: 'var(--text-dim)' }}>{capability.boundary}</p>
            <p className="mt-4 text-xs" style={{ color: 'var(--muted)' }}>
              Owner: {capability.owner} · 引用：{capability.sourceIds.join(', ')}
            </p>
          </article>
        ))}
      </section>
    </div>
  );
}
