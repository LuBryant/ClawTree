import { ingestionRuns } from '../../lib/public-data';

export default function AdminIngestionPage() {
  return (
    <div className="flex flex-col gap-6">
      <section>
        <h1 className="font-normal leading-none tracking-tight" style={{ fontSize: 'clamp(1.6rem, 3.5vw, 2.6rem)' }}>
          采集运行
        </h1>
        <p className="mt-2 text-sm" style={{ color: 'var(--muted)' }}>
          DATA-2 可视化：游标、计数、成本、失败与重跑线索。当前使用离线 fixture，不触发外部采集。
        </p>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        {ingestionRuns.map((run) => (
          <article key={run.id} className="panel p-5">
            <div className="flex flex-wrap items-center gap-2">
              <span className={run.status === 'succeeded' ? 'badge badge-success' : 'badge badge-warning'}>{run.status}</span>
              <span className="badge">{run.platform}</span>
              <span className="badge">owner: {run.owner}</span>
            </div>
            <h2 className="mt-4 text-xl font-black">{run.connector}</h2>
            <dl className="mt-5 grid grid-cols-2 gap-3 text-sm">
              <div className="panel-deep p-3"><dt style={{ color: 'var(--muted)' }}>采集</dt><dd className="mt-1 font-black">{run.collected}</dd></div>
              <div className="panel-deep p-3"><dt style={{ color: 'var(--muted)' }}>新增</dt><dd className="mt-1 font-black">{run.added}</dd></div>
              <div className="panel-deep p-3"><dt style={{ color: 'var(--muted)' }}>重复</dt><dd className="mt-1 font-black">{run.duplicates}</dd></div>
              <div className="panel-deep p-3"><dt style={{ color: 'var(--muted)' }}>失败</dt><dd className="mt-1 font-black">{run.failed}</dd></div>
            </dl>
            <div className="mt-5 grid gap-2 text-xs" style={{ color: 'var(--text-dim)' }}>
              <span>Cursor before: <code>{run.cursorBefore}</code></span>
              <span>Cursor after: <code>{run.cursorAfter}</code></span>
              <span>Duration: {run.duration} · Cost: {run.cost}</span>
            </div>
            <button type="button" className="btn-outline btn-sm mt-5">模拟重跑（无外部副作用）</button>
          </article>
        ))}
      </section>
    </div>
  );
}
