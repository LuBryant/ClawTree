'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { getDeepSeekClient, type ToolDef } from '../lib/llm-client';
import { SYSTEM_PROMPT, QUICK_ACTIONS } from '../lib/assistant-config';

interface Message {
  id: number;
  sender: 'user' | 'assistant';
  text: string;
}

export default function ChatDialog({ onClose }: { onClose: () => void }) {
  const [messages, setMessages] = useState<Message[]>(() => {
    const welcome: Message = {
      id: 1,
      sender: 'assistant',
      text: '👋 你好！我是大树财经的 AI 客服助手。\n\n我可以帮你解答：\n• 🌳 大树财经是什么平台\n• 🤝 合作模式与活动流程\n• 🏆 Genesis 黑客松报名\n• 💰 资源支持与权益\n• 🔍 ClawTree 平台功能\n\n试试问我问题，或者点击下方快捷提问 👇',
    };
    return [welcome];
  });
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const chatHistory = useRef<Array<{ role: string; content: string }>>([
    { role: 'system', content: SYSTEM_PROMPT },
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
      const client = getDeepSeekClient();
      const result = await client.streamChat(chatHistory.current, undefined, {
        onChunk: (chunk) => {
          asstMsg.text += chunk;
          setMessages((prev) =>
            prev.map((m) => (m.id === asstMsg.id ? { ...m, text: asstMsg.text } : m)),
          );
        },
      });

      const finalText = result.content || asstMsg.text || '（AI 未返回有效响应，请重试）';
      asstMsg.text = finalText;
      setMessages((prev) =>
        prev.map((m) => (m.id === asstMsg.id ? { ...m, text: finalText } : m)),
      );
      chatHistory.current.push({ role: 'assistant', content: finalText });
    } catch (e) {
      asstMsg.text = `抱歉，请求出错：${(e as Error).message}。请稍后重试。`;
      setMessages((prev) =>
        prev.map((m) => (m.id === asstMsg.id ? { ...m, text: asstMsg.text } : m)),
      );
    } finally {
      setLoading(false);
    }
  }, [loading]);

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
            <h2 className="text-base font-bold text-blue-400">🌳 大树财经 AI 客服</h2>
            <button
              onClick={onClose}
              className="rounded-lg px-2 py-1 text-lg text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200 transition"
            >
              ✕
            </button>
          </div>

          {/* Info bar */}
          <div className="border-b border-zinc-800 bg-zinc-900/50 px-5 py-3">
            <div className="flex items-center gap-2 mb-1">
              <span className="h-2.5 w-2.5 rounded-full bg-blue-400" />
              <span className="text-xs font-semibold tracking-wider text-zinc-400">
                CLAWTREE · AI POWERED
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-zinc-600">Powered by DeepSeek</span>
              <span className="h-2 w-2 rounded-full bg-emerald-400" />
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
            {messages.map((m) => (
              <div
                key={m.id}
                className={`flex ${m.sender === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[85%] whitespace-pre-wrap rounded-xl px-4 py-2.5 text-sm leading-relaxed ${
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
              </div>
            ))}
            <div ref={msgsEnd} />
          </div>

          {/* Quick actions */}
          {!loading && messages.length <= 2 && (
            <div className="grid grid-cols-2 gap-2 px-5 pb-2">
              {QUICK_ACTIONS.map((action) => (
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
              placeholder="输入问题…"
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
