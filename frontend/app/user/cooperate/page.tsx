'use client';

import Link from 'next/link';
import { useState } from 'react';

export default function UserCooperatePage() {
  const [consented, setConsented] = useState(false);
  const [saved, setSaved] = useState(false);

  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_.9fr]">
      <section className="panel p-6">
        <span className="badge badge-warning">Human handoff</span>
        <h2 className="mt-5 text-3xl font-black tracking-tight">申请合作 / 转人工</h2>
        <p className="mt-4 text-sm leading-7" style={{ color: 'var(--text-dim)' }}>
          这里展示的是同意与用途说明的前端样板：留资只用于人工跟进合作咨询，不会自动群发、
          不会上链、不会进入公开页面。真实提交接口接入前，本页不产生外部副作用。
        </p>
        <form className="mt-6 grid gap-4" aria-label="合作意向表单（演示）">
          <input className="input-field" placeholder="学校 / 组织名称" />
          <input className="input-field" placeholder="您的角色（老师 / 学生社团 / 创新中心）" />
          <select className="select-field" defaultValue="">
            <option value="" disabled>想了解的合作类型</option>
            <option>媒体支持与活动复盘</option>
            <option>嘉宾 / Space 联动</option>
            <option>联合活动 / 黑客松</option>
          </select>
          <textarea className="input-field min-h-32" placeholder="请简述活动主题、时间窗口和希望大树支持的部分" />
          <label className="flex items-start gap-3 text-sm leading-6" style={{ color: 'var(--muted)' }}>
            <input
              type="checkbox"
              className="mt-1"
              checked={consented}
              onChange={(event) => { setConsented(event.target.checked); setSaved(false); }}
              aria-required="true"
            />
            我理解本表单仅用于人工跟进合作咨询；AI 不承诺奖金、嘉宾、曝光、投资或回复时间。
          </label>
          <button
            type="button"
            className="btn btn-success disabled:cursor-not-allowed disabled:opacity-40"
            disabled={!consented}
            onClick={() => setSaved(true)}
          >
            保存为演示线索（无外部副作用）
          </button>
          <p className="text-xs" style={{ color: saved ? 'var(--success)' : 'var(--muted)' }} aria-live="polite">
            {saved
              ? '已记录为本地演示线索；未发送、未公开、未上链。'
              : '勾选用途同意后才可保存。本 Demo 不会向任何外部系统提交。'}
          </p>
        </form>
      </section>
      <aside className="panel p-6">
        <h3 className="text-xl font-black">AI 客服边界</h3>
        <ul className="mt-4 grid gap-3 text-sm leading-6" style={{ color: 'var(--text-dim)' }}>
          <li>✓ 只基于审核知识库回答。</li>
          <li>✓ 回答必须带来源或信息日期。</li>
          <li>✓ 未知/过期/冲突信息转人工。</li>
          <li>✕ 不承诺奖金、嘉宾、曝光、投资、主办身份和回复时间。</li>
        </ul>
        <Link href="/demo" className="mt-6 inline-flex btn-outline">查看审批 Demo →</Link>
      </aside>
    </div>
  );
}
