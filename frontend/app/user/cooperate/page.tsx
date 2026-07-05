'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useLanguage } from '../../i18n/LanguageProvider';
import { DEMO_WORKSPACE } from '../../config/workspaces';

export default function UserCooperatePage() {
  const [consented, setConsented] = useState(false);
  const [saved, setSaved] = useState(false);
  const { tx } = useLanguage();

  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_.9fr]">
      <section className="panel p-6">
        <span className="badge badge-warning">Human handoff</span>
        <h2 className="mt-5 text-3xl font-black tracking-tight">{tx('申请合作 / 转人工', 'Partnership inquiry / Human support')}</h2>
        <p className="mt-4 text-sm leading-7" style={{ color: 'var(--text-dim)' }}>
          {tx('这里展示的是同意与用途说明的前端样板：留资只用于人工跟进合作咨询，不会自动群发、不会上链、不会进入公开页面。真实提交接口接入前，本页不产生外部副作用。', 'This consent-first prototype only saves details for human partnership follow-up. It never mass-emails, writes data onchain, or exposes it publicly. Until a live submission endpoint is connected, this page has no external side effects.')}
        </p>
        <form className="mt-6 grid gap-4" aria-label={tx('合作意向表单（演示）', 'Partnership interest form (demo)')}>
          <input className="input-field" placeholder={tx('学校 / 组织名称', 'School / organization')} />
          <input className="input-field" placeholder={tx('您的角色（老师 / 学生社团 / 创新中心）', 'Your role (educator / student group / innovation center)')} />
          <select className="select-field" defaultValue="">
            <option value="" disabled>{tx('想了解的合作类型', 'Partnership type')}</option>
            <option>{tx('媒体支持与活动复盘', 'Media support and event recap')}</option>
            <option>{tx('嘉宾 / Space 联动', 'Guest / X Space collaboration')}</option>
            <option>{tx('联合活动 / 黑客松', 'Joint event / hackathon')}</option>
          </select>
          <textarea className="input-field min-h-32" placeholder={tx(`请简述活动主题、时间窗口和希望${DEMO_WORKSPACE.name}支持的部分`, `Describe your theme, timeframe, and the support you need from ${DEMO_WORKSPACE.nameEn}`)} />
          <label className="flex items-start gap-3 text-sm leading-6" style={{ color: 'var(--muted)' }}>
            <input
              type="checkbox"
              className="mt-1"
              checked={consented}
              onChange={(event) => { setConsented(event.target.checked); setSaved(false); }}
              aria-required="true"
            />
            {tx('我理解本表单仅用于人工跟进合作咨询；AI 不承诺奖金、嘉宾、曝光、投资或回复时间。', 'I understand this form is only for human partnership follow-up. AI cannot promise prizes, guests, exposure, investment, or response times.')}
          </label>
          <button
            type="button"
            className="btn btn-success disabled:cursor-not-allowed disabled:opacity-40"
            disabled={!consented}
            onClick={() => setSaved(true)}
          >
            {tx('保存为演示线索（无外部副作用）', 'Save demo lead (no external side effects)')}
          </button>
          <p className="text-xs" style={{ color: saved ? 'var(--success)' : 'var(--muted)' }} aria-live="polite">
            {saved
              ? tx('已记录为本地演示线索；未发送、未公开、未上链。', 'Saved locally as a demo lead. Nothing was sent, published, or written onchain.')
              : tx('勾选用途同意后才可保存。本 Demo 不会向任何外部系统提交。', 'Consent is required before saving. This demo submits nothing to external systems.')}
          </p>
        </form>
      </section>
      <aside className="panel p-6">
        <h3 className="text-xl font-black">{tx('AI 客服边界', 'AI support boundaries')}</h3>
        <ul className="mt-4 grid gap-3 text-sm leading-6" style={{ color: 'var(--text-dim)' }}>
          <li>✓ {tx('只基于审核知识库回答。', 'Answers only from reviewed knowledge.')}</li>
          <li>✓ {tx('回答必须带来源或信息日期。', 'Answers include a source or knowledge date.')}</li>
          <li>✓ {tx('未知/过期/冲突信息转人工。', 'Unknown, stale, or conflicting information goes to a human.')}</li>
          <li>✕ {tx('不承诺奖金、嘉宾、曝光、投资、主办身份和回复时间。', 'No promises about prizes, guests, exposure, investment, host status, or response times.')}</li>
        </ul>
        <Link href="/demo" className="mt-6 inline-flex btn-outline">{tx('查看审批 Demo', 'View approval demo')} →</Link>
      </aside>
    </div>
  );
}
