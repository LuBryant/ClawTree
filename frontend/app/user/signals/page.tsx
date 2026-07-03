import { publicSignals } from '../../lib/public-data';

export default function UserSignalsPage() {
  return (
    <div className="flex flex-col gap-5">
      <section>
        <h2 className="text-3xl font-black tracking-tight">校园与 AI/Web3 Signals</h2>
        <p className="mt-2 text-sm" style={{ color: 'var(--muted)' }}>
          区分公开事实、AI 摘要和编辑边界；所有信号都保留来源和抓取时间。
        </p>
      </section>
      <div className="grid gap-4 md:grid-cols-2">
        {publicSignals.map((signal) => (
          <article key={signal.id} className="panel p-5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="badge badge-success">事实 · {signal.verification}</span>
              <span className="badge badge-info">AI 摘要</span>
              <span className="badge">{signal.kind}</span>
            </div>
            <h3 className="mt-4 text-xl font-black">{signal.title}</h3>
            <p className="mt-3 text-sm leading-7" style={{ color: 'var(--text-dim)' }}>{signal.summary}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              {signal.tags.map((tag) => <span key={tag} className="badge">{tag}</span>)}
            </div>
            <div className="mt-5 grid gap-2 text-xs" style={{ color: 'var(--muted)' }}>
              <span>发布时间：{signal.publishedDate}</span>
              <span>抓取/核验：{signal.fetchedDate}</span>
              <span>边界：{signal.boundary}</span>
            </div>
            <a href={signal.url} target="_blank" rel="noreferrer" className="mt-5 inline-flex text-sm font-black" style={{ color: 'var(--info)' }}>
              原始来源 ↗
            </a>
          </article>
        ))}
      </div>
    </div>
  );
}
