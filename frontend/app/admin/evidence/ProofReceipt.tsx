'use client';

import { useState } from 'react';

import demo from '../../../data/demo.json';
import { useLanguage } from '../../i18n/LanguageProvider';

type ProofReceipt = {
  network: string;
  payloadHash: string;
  txHash: string;
  isMock: boolean;
  privacyFields: string[];
  externalSideEffect: false;
  publicPayload: Record<string, unknown>;
};

async function hashPayload(payload: Record<string, unknown>) {
  const normalized = JSON.stringify(payload, Object.keys(payload).sort());
  const digest = await window.crypto.subtle.digest('SHA-256', new TextEncoder().encode(normalized));
  return `0x${Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, '0')).join('')}`;
}

export default function ProofReceiptPanel({ candidateName, tierName }: { candidateName: string; tierName: string }) {
  const { tx } = useLanguage();
  const [receipt, setReceipt] = useState<ProofReceipt | null>(null);
  const [status, setStatus] = useState<'idle' | 'generating' | 'verified' | 'invalid'>('idle');
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');

  async function generateReceipt() {
    setStatus('generating');
    setError('');
    try {
      const response = await fetch('/api/proofs/anchor', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          campaignId: demo.campaign.id,
          workspaceId: demo.workspace.id,
          draftId: `draft-judge-${Date.now()}`,
        }),
      });
      if (!response.ok) throw new Error('proof request failed');
      const nextReceipt = await response.json() as ProofReceipt;
      const recalculated = await hashPayload(nextReceipt.publicPayload);
      setReceipt(nextReceipt);
      setStatus(recalculated === nextReceipt.payloadHash ? 'verified' : 'invalid');
    } catch {
      setStatus('idle');
      setError(tx('凭证生成失败，请重试。', 'Proof generation failed. Please retry.'));
    }
  }

  async function verifyReceipt() {
    if (!receipt) return;
    const recalculated = await hashPayload(receipt.publicPayload);
    setStatus(recalculated === receipt.payloadHash ? 'verified' : 'invalid');
  }

  async function copyHash() {
    if (!receipt) return;
    await navigator.clipboard.writeText(receipt.payloadHash);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  }

  function downloadReceipt() {
    if (!receipt) return;
    const artifact = {
      ...receipt,
      decisionContext: { candidateName, tierName, anchored: false },
      generatedAt: new Date().toISOString(),
    };
    const url = URL.createObjectURL(new Blob([JSON.stringify(artifact, null, 2)], { type: 'application/json' }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `clawtree-proof-${receipt.payloadHash.slice(2, 10)}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <section className="panel p-5" aria-labelledby="proof-receipt-title">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-black uppercase tracking-widest" style={{ color: 'var(--info)' }}>08 / PRIVACY-SAFE PROOF RECEIPT</p>
          <h2 id="proof-receipt-title" className="mt-2 text-xl font-black">{tx('生成、复算、下载一张可验证凭证', 'Generate, recompute, and download a verifiable receipt')}</h2>
          <p className="mt-2 max-w-3xl text-xs leading-6" style={{ color: 'var(--muted)' }}>
            {tx('浏览器会重新计算服务端返回的规范化 SHA-256；联系人、正文、回复和 Prompt 永不进入凭证。当前主舞台使用 TRON Nile Mock，真实钱包路径保留在外联审批页。', 'The browser independently recomputes the canonical SHA-256. Contacts, message bodies, replies, and prompts never enter the receipt. The main stage uses a TRON Nile mock; the live-wallet path remains in Outreach Review.')}
          </p>
        </div>
        <div className="flex flex-wrap gap-2 text-xs">
          <span className="badge">{candidateName}</span>
          <span className="badge">{tierName}</span>
          <span className="badge badge-warning">decision context not anchored</span>
        </div>
      </div>

      {!receipt ? (
        <div className="panel-deep mt-5 flex min-h-48 flex-col items-center justify-center p-6 text-center">
          <div className="text-4xl">◎</div>
          <strong className="mt-4 text-sm">{tx('批准动作之后，只锚定公开摘要', 'After approval, anchor only the public summary')}</strong>
          <p className="mt-2 max-w-xl text-xs leading-6" style={{ color: 'var(--muted)' }}>campaignId · workspaceId · draftId · signalIds · approvalStatus</p>
          <button type="button" className="btn btn-success btn-sm mt-5" onClick={generateReceipt} disabled={status === 'generating'}>
            {status === 'generating' ? tx('正在生成并复算…', 'Generating and verifying…') : tx('生成 Proof Receipt', 'Generate proof receipt')}
          </button>
          {error && <p className="mt-3 text-xs" style={{ color: 'var(--danger)' }}>{error}</p>}
        </div>
      ) : (
        <div className="mt-5 grid gap-4 xl:grid-cols-[1.05fr_.95fr]">
          <div className="panel-deep p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span className={status === 'verified' ? 'badge badge-success' : 'badge badge-warning'}>
                {status === 'verified' ? 'HASH MATCH · VERIFIED' : 'HASH MISMATCH'}
              </span>
              <span className="badge">{receipt.network}</span>
            </div>
            <p className="mt-5 text-xs font-black uppercase tracking-wider" style={{ color: 'var(--muted)' }}>Payload SHA-256</p>
            <code className="mt-2 block break-all text-sm leading-6" style={{ color: 'var(--info)' }}>{receipt.payloadHash}</code>
            <p className="mt-4 text-xs font-black uppercase tracking-wider" style={{ color: 'var(--muted)' }}>Mock transaction</p>
            <code className="mt-2 block break-all text-xs leading-5" style={{ color: 'var(--text-dim)' }}>{receipt.txHash}</code>
            <div className="mt-5 flex flex-wrap gap-2">
              <button type="button" className="btn btn-success btn-sm" onClick={verifyReceipt}>{tx('浏览器重新验证', 'Verify in browser')}</button>
              <button type="button" className="btn btn-sm" onClick={copyHash}>{copied ? tx('已复制', 'Copied') : tx('复制哈希', 'Copy hash')}</button>
              <button type="button" className="btn btn-sm" onClick={downloadReceipt}>{tx('下载 JSON', 'Download JSON')}</button>
              <button type="button" className="btn btn-sm" onClick={generateReceipt}>{tx('重新生成', 'Regenerate')}</button>
            </div>
          </div>

          <div className="panel-deep p-5">
            <strong className="text-xs uppercase tracking-wider">{tx('隐私字段白名单', 'Privacy allowlist')}</strong>
            <div className="mt-3 flex flex-wrap gap-2">
              {receipt.privacyFields.map((field) => <span key={field} className="badge badge-success">{field}</span>)}
            </div>
            <strong className="mt-5 block text-xs uppercase tracking-wider" style={{ color: 'var(--danger)' }}>{tx('明确排除', 'Explicitly excluded')}</strong>
            <div className="mt-3 flex flex-wrap gap-2">
              {['email', 'contact', 'message body', 'reply', 'prompt', 'chain of thought'].map((field) => <span key={field} className="badge badge-warning">× {field}</span>)}
            </div>
            <pre className="mt-5 max-h-48 overflow-auto border p-3 text-[11px] leading-5" style={{ borderColor: 'var(--line)', color: 'var(--muted)' }}>{JSON.stringify(receipt.publicPayload, null, 2)}</pre>
            <p className="mt-3 text-xs" style={{ color: 'var(--muted)' }}>isMock={String(receipt.isMock)} · externalSideEffect={String(receipt.externalSideEffect)}</p>
          </div>
        </div>
      )}
    </section>
  );
}
