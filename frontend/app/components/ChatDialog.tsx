'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { getAssistantClient, type AssistantCitation } from '../lib/llm-client';
import { QUICK_ACTIONS } from '../lib/assistant-config';

interface Message {
  id: number;
  sender: 'user' | 'assistant';
  text: string;
  citations?: AssistantCitation[];
  knowledgeAsOf?: string;
  mode?: 'rag_model' | 'faq_fallback' | 'policy_refusal';
  handoff?: { required: boolean; reason: string | null; url: string };
}

export default function ChatDialog({ onClose }: { onClose: () => void }) {
  const [messages, setMessages] = useState<Message[]>(() => {
    const welcome: Message = {
      id: 1,
      sender: 'assistant',
      text: '你好，我是大树财经的 AI 客服助手。\n\n我只根据已审核、带来源和有效期的知识回答；遇到未知、过期或需要确认的合作信息，会明确转人工。请选择你的身份，或直接提问。',
    };
    return [welcome];
  });
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [audience, setAudience] = useState<'teacher' | 'student'>('teacher');
  const [serviceMode, setServiceMode] = useState<'idle' | 'rag_model' | 'faq_fallback' | 'policy_refusal'>('idle');
  const chatHistory = useRef<Array<{ role: 'user' | 'assistant'; content: string }>>([
    { role: 'assistant', content: messages[0].text },
  ]);
  const msgsEnd = useRef<HTMLDivElement>(null);

  useEffect(() => {
    msgsEnd.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const send = useCallback(async (text: string) => {
    const txt = text.trim();
    if (!txt || loading) return;

    const userMsg: Message = { id: Date.now(), sender: 'user', text: txt };
    setMessages((prev) => [...prev, userMsg]);
    chatHistory.current.push({ role: 'user', content: txt });

    setInput('');
    setLoading(true);

    const asstMsg: Message = { id: Date.now() + 1, sender: 'assistant', text: '' };
    setMessages((prev) => [...prev, asstMsg]);

    try {
      const client = getAssistantClient();
      const result = await client.streamChat(chatHistory.current, { audience });

      const finalText = result.content || asstMsg.text || '（AI 未返回有效响应，请重试）';
      asstMsg.text = finalText;
      setMessages((prev) =>
        prev.map((m) => (m.id === asstMsg.id ? {
          ...m,
          text: finalText,
          citations: result.citations,
          knowledgeAsOf: result.knowledgeAsOf,
          mode: result.mode,
          handoff: result.handoff,
        } : m)),
      );
      setServiceMode(result.mode);
      chatHistory.current.push({ role: 'assistant', content: finalText });
    } catch {
      asstMsg.text = '客服连接暂时不可用。你可以前往合作咨询页转人工；提交前会明确说明信息用途。';
      setMessages((prev) =>
        prev.map((m) => (m.id === asstMsg.id ? {
          ...m,
          text: asstMsg.text,
          handoff: { required: true, reason: 'client_unavailable', url: '/user/cooperate' },
        } : m)),
      );
    } finally {
      setLoading(false);
    }
  }, [audience, loading]);

  const serviceLabel = serviceMode === 'rag_model'
    ? 'RAG + 模型组织'
    : serviceMode === 'faq_fallback'
      ? '本地 FAQ 检索'
      : serviceMode === 'policy_refusal'
        ? '安全边界回答'
        : '等待首次检索';

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/50 backdrop-blur-sm"
        onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      >
        <div
          className="flex h-[660px] max-h-[88vh] w-[560px] max-w-[95vw] flex-col overflow-hidden rounded-2xl border border-zinc-700 bg-zinc-900 shadow-2xl"
          style={{ animation: 'popIn 0.22s ease' }}
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-zinc-800 px-5 py-4">
            <div>
              <h2 className="text-base font-bold text-emerald-300">大树财经 AI 客服</h2>
              <p className="mt-0.5 text-[10px] text-zinc-500">Reviewed knowledge · Human-safe</p>
            </div>
            <button
              onClick={onClose}
              className="rounded-lg px-2 py-1 text-lg text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200 transition"
            >
              ✕
            </button>
          </div>

          {/* Info bar */}
          <div className="border-b border-zinc-800 bg-zinc-900/50 px-5 py-3">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="text-emerald-300">◆</span>
                <span className="text-[11px] font-semibold text-zinc-300">审核知识库 · {serviceLabel}</span>
              </div>
              <span className="text-[10px] text-zinc-500">不代表人工确认</span>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2" aria-label="选择咨询身份">
              {(['teacher', 'student'] as const).map((role) => (
                <button
                  type="button"
                  key={role}
                  onClick={() => setAudience(role)}
                  className={`rounded-lg border px-3 py-2 text-xs font-bold transition ${audience === role
                    ? 'border-emerald-400/60 bg-emerald-400/10 text-emerald-200'
                    : 'border-zinc-700 text-zinc-500 hover:text-zinc-300'}`}
                  aria-pressed={audience === role}
                >
                  {role === 'teacher' ? '我是高校老师' : '我是学生 / 社团'}
                </button>
              ))}
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
            {messages.map((m) => (
              <div
                key={m.id}
                className={`flex ${m.sender === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div className={`max-w-[88%] ${m.sender === 'user' ? '' : 'grid gap-2'}`}>
                  <div
                    className={`whitespace-pre-wrap rounded-xl px-4 py-2.5 text-sm leading-relaxed ${
                    m.sender === 'user'
                      ? 'bg-blue-500 text-white rounded-br-sm'
                      : 'border border-zinc-700 bg-zinc-800 text-zinc-200 rounded-bl-sm'
                  }`}
                  >
                    {m.text || (
                      <span className="flex items-center gap-1.5">
                        <span className="h-2 w-2 animate-bounce rounded-full bg-zinc-500 [animation-delay:0s]" />
                        <span className="h-2 w-2 animate-bounce rounded-full bg-zinc-500 [animation-delay:0.2s]" />
                        <span className="h-2 w-2 animate-bounce rounded-full bg-zinc-500 [animation-delay:0.4s]" />
                      </span>
                    )}
                  </div>
                  {m.sender === 'assistant' && m.citations && m.citations.length > 0 && (
                    <div className="rounded-xl border border-emerald-400/20 bg-emerald-400/5 px-3 py-2">
                      <div className="mb-1.5 flex items-center justify-between gap-2 text-[10px]">
                        <span className="font-bold text-emerald-300">引用 {m.citations.length} 条审核知识</span>
                        <span className="text-zinc-500">信息日期 {m.knowledgeAsOf}</span>
                      </div>
                      <div className="grid gap-1">
                        {m.citations.map((citation, index) => (
                          <a key={citation.id} href={citation.url} className="text-[11px] text-blue-300 hover:text-blue-200">
                            [{index + 1}] {citation.label} · {citation.checkedAt} ↗
                          </a>
                        ))}
                      </div>
                    </div>
                  )}
                  {m.sender === 'assistant' && m.handoff?.required && (
                    <a href={m.handoff.url} className="rounded-lg border border-amber-400/30 bg-amber-400/10 px-3 py-2 text-center text-xs font-bold text-amber-200">
                      转人工合作咨询 →
                    </a>
                  )}
                </div>
              </div>
            ))}
            <div ref={msgsEnd} />
          </div>

          {/* Quick actions — 始终显示 */}
          {!loading && (
            <div className="grid grid-cols-2 gap-2 px-5 pb-2">
              {QUICK_ACTIONS[audience].map((action) => (
                <button
                  key={action}
                  onClick={() => send(action)}
                  className="rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2.5 text-left text-xs leading-relaxed text-zinc-300 hover:border-blue-500 hover:bg-zinc-800/80 transition"
                >
                  {action}
                </button>
              ))}
            </div>
          )}

          {/* Input */}
          <div className="flex items-center gap-2 border-t border-zinc-800 px-5 py-4">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !loading) send(input); }}
              placeholder={audience === 'teacher' ? '咨询合作模式、资源边界…' : '咨询活动、报名与隐私…'}
              className="flex-1 rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-2.5 text-sm text-zinc-200 outline-none placeholder:text-zinc-600 focus:border-blue-500 transition"
              disabled={loading}
            />
            <button
              onClick={() => send(input)}
              disabled={loading || !input.trim()}
              className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500 text-base text-white transition hover:bg-blue-400 disabled:opacity-30"
            >
              ➤
            </button>
          </div>
        </div>
      </div>

      <style jsx>{`
        @keyframes popIn {
          from { opacity: 0; transform: scale(0.94) translateY(10px); }
          to { opacity: 1; transform: none; }
        }
      `}</style>
    </>
  );
}
