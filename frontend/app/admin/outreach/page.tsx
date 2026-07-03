import { outreachBatches } from '../../lib/public-data';

export default function AdminOutreachPage() {
  const batch = outreachBatches[0];

  return (
    <div className="flex flex-col gap-6">
      <section>
        <h1 className="font-normal leading-none tracking-tight" style={{ fontSize: 'clamp(1.6rem, 3.5vw, 2.6rem)' }}>
          外联审批
        </h1>
        <p className="mt-2 text-sm" style={{ color: 'var(--muted)' }}>
          一校一 proposal、一校一邮件草稿。当前页面只展示模拟批次，不创建真实邮件、不发送、不写外部系统。
        </p>
      </section>

      <section className="panel p-5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="badge badge-warning">{batch.status}</span>
          <span className="badge">externalSideEffect: {String(batch.externalSideEffect)}</span>
          <span className="badge">daily limit {batch.dailyLimit}</span>
          <span className="badge">stop switch {batch.stopSwitch ? 'on' : 'off'}</span>
        </div>
        <h2 className="mt-4 text-2xl font-black">{batch.name}</h2>
      </section>

      <section className="grid gap-4">
        {batch.messages.map((message) => (
          <article key={message.id} className="panel p-5">
            <div className="flex flex-wrap items-center gap-2">
              <span className={message.status === 'awaiting_human_approval' ? 'badge badge-warning' : 'badge'}>{message.status}</span>
              <span className="badge">{message.proposalVersion}</span>
            </div>
            <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_.9fr]">
              <div>
                <h3 className="text-xl font-black">{message.organization}</h3>
                <p className="mt-3 text-sm" style={{ color: 'var(--muted)' }}>收件人：{message.recipient}</p>
                <p className="mt-2 text-xs" style={{ color: 'var(--text-dim)' }}>
                  幂等键：<code>{message.idempotencyKey}</code>
                </p>
              </div>
              <div className="panel-deep p-3 text-sm leading-6" style={{ color: 'var(--muted)' }}>
                <strong style={{ color: 'var(--text)' }}>风险检查</strong>
                <p className="mt-2">不得承诺：{message.risk}</p>
                <p>未批准批次发送数始终为 0；批准后仍需限速、退订和停止开关。</p>
              </div>
            </div>
            <div className="mt-5 flex flex-wrap gap-2">
              <button className="btn btn-success btn-sm" type="button">批准模拟发送</button>
              <button className="btn-outline btn-sm" type="button">停止批次</button>
              <button className="btn-outline btn-sm" type="button">导出会前 brief</button>
            </div>
          </article>
        ))}
      </section>
    </div>
  );
}
