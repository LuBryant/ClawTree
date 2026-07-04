'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  fetchOutreachDrafts, approveOutreachDraft, rejectOutreachDraft, anchorOutreachProof,
  type OutreachDraft,
} from '../../lib/api-client';
import { useOutreachContract } from '../../hooks/useOutreachContract';
import { useTronWallet } from '../../hooks/useTronWallet';

const STATUS_LABEL: Record<string, string> = {
  draft: '草稿',
  awaiting_approval: '待审批',
  approved: '已批准',
  rejected: '已驳回',
};

export default function AdminOutreachPage() {
  const [drafts, setDrafts] = useState<OutreachDraft[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [proving, setProving] = useState<Set<number>>(new Set());
  const { anchor: contractAnchor } = useOutreachContract();
  const tron = useTronWallet();

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const data = await fetchOutreachDrafts();
      setDrafts(data);
    } catch {
      setError('无法连接后端 API');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleApprove = async (id: number, editedBody?: string) => {
    try {
      const res = await approveOutreachDraft(id, 'admin', editedBody);
      setDrafts((p) => p.map((d) => d.id === id ? { ...d, status: 'approved' as const } : d));
      if (res.sent) {
        alert('✅ 邮件已批准并发送成功');
      } else {
        alert(`⚠️ 已批准但发送失败：${res.reason || '未知原因'}`);
      }
    } catch { alert('审批失败'); }
  };

  const handleReject = async (id: number) => {
    try {
      await rejectOutreachDraft(id);
      setDrafts((p) => p.map((d) => d.id === id ? { ...d, status: 'rejected' as const } : d));
    } catch { alert('驳回失败'); }
  };

  const anchorProof = async (d: OutreachDraft) => {
    setProving((p) => new Set(p).add(d.id));
    try {
      const result = await contractAnchor({
        outreachId: `clawtree-outreach-${d.id}-${Date.now()}`,
        university: d.university_name,
        eventTitle: d.event_title,
        emailBodyHash: d.email_body,
      });

      // 链上凭证保存到后端数据库
      const saved = await anchorOutreachProof(d.id, {
        tx_hash: result.txHash,
        network: result.network,
        explorer_url: result.explorerUrl,
      });

      // 更新本地状态
      setDrafts((p) => p.map((item) => item.id === d.id ? {
        ...item,
        proof_tx_hash: saved.proof_tx_hash,
        proof_network: result.network,
        proof_explorer_url: saved.proof_explorer_url,
        proof_created_at: new Date().toISOString(),
      } : item));
    } catch {
      alert('链上凭证生成失败，请确认 TronLink 已连接 TRON Nile 测试网');
    } finally {
      setProving((p) => { const n = new Set(p); n.delete(d.id); return n; });
    }
  };

  const formatDate = (s: string | null) => {
    if (!s) return '';
    return new Date(s).toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
  };

  const pending = drafts.filter((d) => d.status === 'draft' || d.status === 'awaiting_approval');
  const processed = drafts.filter((d) => d.status === 'approved' || d.status === 'rejected');

  return (
    <div className="flex flex-col gap-6">
      <section>
        <h1 className="font-normal leading-none tracking-tight" style={{ fontSize: 'clamp(1.6rem, 3.5vw, 2.6rem)' }}>
          外联审批
        </h1>
        <p className="mt-2 text-sm" style={{ color: 'var(--muted)' }}>
          AI 生成的外联邮件草稿，须逐校逐封人工审批后方可发送。
          {drafts.length > 0 && <span> — 共 <span style={{ color: 'var(--success)', fontWeight: 950 }}>{drafts.length}</span> 封</span>}
        </p>
      </section>

      {/* 钱包状态 — TRON Nile gas 余额 */}
      <section className="flex flex-wrap items-center gap-4 text-xs font-mono"
        style={{ border: '1px solid var(--line)', background: 'var(--panel-2)', padding: '10px 16px' }}>
        {tron.isConnected ? (
          <>
            <span style={{ color: 'var(--success)' }}>⚡ TRON Nile</span>
            <span style={{ color: 'var(--muted)' }}>{tron.address?.slice(0, 6)}…{tron.address?.slice(-4)}</span>
            <span style={{ color: 'var(--warning)', fontWeight: 950 }}>{tron.balance || '—'}</span>
            <span className="ml-auto text-xs" style={{ color: 'var(--muted)' }}>
              HTX 生态 · 链上凭证 gas 余额
            </span>
          </>
        ) : (
          <>
            <span style={{ color: 'var(--muted)' }}>⚡ TRON Nile</span>
            <span style={{ color: 'var(--danger)' }}>未连接</span>
            <button onClick={tron.connect} className="btn-outline btn-sm ml-auto"
              style={{ minHeight: 28, padding: '0 10px', fontSize: '0.72rem' }}>
              🔗 连接 TronLink
            </button>
          </>
        )}
      </section>

      {error && (
        <div className="text-center py-8" style={{ border: '1px solid rgba(255,61,87,0.42)', background: 'rgba(255,61,87,0.08)', color: 'var(--danger)' }}>
          <p className="text-sm font-bold">{error}</p>
        </div>
      )}

      {loading && <div className="flex justify-center py-20"><div className="spinner" /></div>}

      {!loading && !error && drafts.length === 0 && (
        <div className="text-center py-16" style={{ color: 'var(--muted)' }}>
          暂无外联草稿，请先在活动浏览器中 AI 生成合作邮件。
        </div>
      )}

      {/* 待审批 */}
      {pending.length > 0 && (
        <section>
          <h2 className="text-sm font-black uppercase tracking-widest mb-3" style={{ color: 'var(--warning)' }}>
            ⏳ 待审批 ({pending.length})
          </h2>
          <div className="grid gap-4">
            {pending.map((d) => (
              <DraftCard key={d.id} draft={d} formatDate={formatDate}
                onApprove={(body) => handleApprove(d.id, body)}
                onReject={() => handleReject(d.id)}
                proving={proving.has(d.id)}
                onAnchor={() => anchorProof(d)} />
            ))}
          </div>
        </section>
      )}

      {/* 已处理 */}
      {processed.length > 0 && (
        <section>
          <h2 className="text-sm font-black uppercase tracking-widest mb-3" style={{ color: 'var(--muted)' }}>
            ✅ 已处理 ({processed.length})
          </h2>
          <div className="grid gap-4 opacity-60">
            {processed.map((d) => (
              <DraftCard key={d.id} draft={d} formatDate={formatDate}
                proving={proving.has(d.id)}
                onAnchor={() => anchorProof(d)} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function DraftCard({ draft: d, formatDate, onApprove, onReject, proving, onAnchor }: {
  draft: OutreachDraft;
  formatDate: (s: string | null) => string;
  onApprove?: (editedBody: string) => void;
  onReject?: () => void;
  proving?: boolean;
  onAnchor?: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [body, setBody] = useState(d.email_body);

  const statusColors: Record<string, string> = {
    draft: 'var(--warning)', awaiting_approval: 'var(--warning)',
    approved: 'var(--success)', rejected: 'var(--danger)',
  };
  const statusBgs: Record<string, string> = {
    draft: 'rgba(248,214,109,0.1)', awaiting_approval: 'rgba(248,214,109,0.1)',
    approved: 'rgba(22,242,179,0.1)', rejected: 'rgba(255,61,87,0.1)',
  };

  const isPending = d.status === 'draft' || d.status === 'awaiting_approval';
  // 链上凭证来自数据库
  const hasProof = !!(d.proof_tx_hash);

  return (
    <article className="panel p-5">
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <span className="badge" style={{ borderColor: statusColors[d.status], background: statusBgs[d.status], color: statusColors[d.status] }}>
          {STATUS_LABEL[d.status]}
        </span>
        <span className="text-xs" style={{ color: 'var(--muted)' }}>{d.university_name}</span>
        <span className="text-xs font-bold" style={{ color: 'var(--text-dim)' }}>{d.event_title}</span>
      </div>
      <div className="grid gap-4 lg:grid-cols-[1fr_1.2fr]">
        <div>
          <p className="text-xs mb-1" style={{ color: 'var(--muted)' }}>收件人：{d.recipient_email || '待补全'}</p>
          <p className="text-xs" style={{ color: 'var(--muted)' }}>创建时间：{formatDate(d.created_at)}</p>
          {d.approved_at && <p className="text-xs" style={{ color: 'var(--success)' }}>审批时间：{formatDate(d.approved_at)}</p>}
          {d.proof_created_at && <p className="text-xs" style={{ color: 'var(--info)' }}>链上凭证：{formatDate(d.proof_created_at)}</p>}
        </div>
        <div>
          {isPending ? (
            <textarea
              value={body}
              onChange={(e) => { setBody(e.target.value); if (!editing) setEditing(true); }}
              className="input-field w-full resize-y text-xs leading-relaxed"
              style={{ minHeight: 200, fontFamily: 'inherit' }}
            />
          ) : (
            <div className="panel-deep p-4 text-xs leading-relaxed max-h-64 overflow-y-auto" style={{ color: 'var(--muted)' }}>
              <pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'inherit' }}>{d.email_body}</pre>
            </div>
          )}
        </div>
      </div>
      {(onApprove || onReject) && (
        <div className="mt-4 flex flex-wrap gap-2">
          <button className="btn btn-success btn-sm" onClick={() => onApprove?.(body)}>
            ✅ 批准并发送
          </button>
          <button className="btn btn-outline btn-sm" onClick={() => { setBody(d.email_body); setEditing(false); }}>
            ↩ 还原原文
          </button>
          <button className="btn btn-danger btn-sm" onClick={onReject}>❌ 驳回</button>
        </div>
      )}

      {/* 链上凭证 */}
      {d.status === 'approved' && onAnchor && !hasProof && (
        <div className="mt-3 pt-3" style={{ borderTop: '1px solid var(--line)' }}>
          <button
            className="btn btn-sm"
            style={{ background: 'var(--info)', color: '#fff' }}
            onClick={onAnchor}
            disabled={proving}
          >
            {proving ? '⏳ 生成链上凭证…' : '🔗 生成链上凭证'}
          </button>
        </div>
      )}

      {hasProof && (
        <div className="mt-3 pt-3" style={{ borderTop: '1px solid var(--line)' }}>
          <div className="proof-card">
            <span>PROOF ANCHORED · {d.proof_network.includes('mock') ? 'MOCK' : 'ON-CHAIN'}</span>
            <strong>{d.proof_network}</strong>
            {d.proof_explorer_url ? (
              <a href={d.proof_explorer_url} target="_blank" rel="noopener noreferrer"
                className="text-sm font-mono break-all transition hover:brightness-125"
                style={{ color: 'var(--info)', textDecoration: 'underline' }}>
                TX: {d.proof_tx_hash}
              </a>
            ) : (
              <code style={{ wordBreak: 'break-all' }}>TX: {d.proof_tx_hash}</code>
            )}
            <small>仅包含外联 ID、高校名称、活动标题、邮件哈希；不含联系人和邮件正文。</small>
          </div>
        </div>
      )}
    </article>
  );
}
