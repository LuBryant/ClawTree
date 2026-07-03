import { ASSISTANT_SYSTEM_PROMPT } from '../../../lib/assistant-prompt.server';

export const runtime = 'nodejs';

type ChatMessage = { role: 'user' | 'assistant'; content: string };

const MAX_MESSAGES = 20;
const MAX_MESSAGE_CHARS = 4_000;
const MAX_TOTAL_CHARS = 20_000;
const DEFAULT_BASE_URL = 'https://api.deepseek.com';
const ALLOWED_PROVIDER_HOSTS = new Set(['api.deepseek.com']);

function errorResponse(error: string, status: number) {
  return Response.json({ error }, { status, headers: { 'cache-control': 'no-store' } });
}

function validateMessages(value: unknown): ChatMessage[] | null {
  if (!Array.isArray(value) || value.length === 0 || value.length > MAX_MESSAGES) return null;
  let totalChars = 0;
  const messages: ChatMessage[] = [];
  for (const item of value) {
    if (!item || typeof item !== 'object') return null;
    const candidate = item as Record<string, unknown>;
    if (candidate.role !== 'user' && candidate.role !== 'assistant') return null;
    if (typeof candidate.content !== 'string') return null;
    const content = candidate.content.trim();
    if (!content || content.length > MAX_MESSAGE_CHARS) return null;
    totalChars += content.length;
    if (totalChars > MAX_TOTAL_CHARS) return null;
    messages.push({ role: candidate.role, content });
  }
  return messages;
}

function providerBaseUrl() {
  const url = new URL(process.env.DEEPSEEK_BASE_URL || DEFAULT_BASE_URL);
  if (url.protocol !== 'https:' || !ALLOWED_PROVIDER_HOSTS.has(url.hostname)) {
    throw new Error('Invalid provider configuration');
  }
  return url;
}

export async function POST(request: Request) {
  if (request.headers.get('content-type')?.split(';')[0].trim() !== 'application/json') {
    return errorResponse('unsupported_media_type', 415);
  }
  const contentLength = Number(request.headers.get('content-length') || 0);
  if (contentLength > 50_000) return errorResponse('payload_too_large', 413);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorResponse('invalid_json', 400);
  }
  const messages = validateMessages(
    body && typeof body === 'object' ? (body as Record<string, unknown>).messages : null,
  );
  if (!messages) return errorResponse('invalid_messages', 400);

  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) return errorResponse('assistant_unavailable', 503);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 60_000);
  try {
    const upstream = await fetch(new URL('/chat/completions', providerBaseUrl()), {
      method: 'POST',
      headers: { authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        model: process.env.DEEPSEEK_MODEL || 'deepseek-chat',
        messages: [{ role: 'system', content: ASSISTANT_SYSTEM_PROMPT }, ...messages],
        stream: true,
        temperature: 0.3,
        max_tokens: 2_048,
      }),
      cache: 'no-store',
      signal: controller.signal,
    });
    if (!upstream.ok || !upstream.body) {
      clearTimeout(timeout);
      return errorResponse('provider_unavailable', 502);
    }
    const { readable, writable } = new TransformStream();
    void upstream.body.pipeTo(writable, { signal: controller.signal })
      .catch(() => undefined)
      .finally(() => clearTimeout(timeout));
    return new Response(readable, {
      headers: {
        'cache-control': 'no-store',
        'content-type': 'text/event-stream; charset=utf-8',
        'x-accel-buffering': 'no',
      },
    });
  } catch {
    clearTimeout(timeout);
    return errorResponse('provider_unavailable', 502);
  }
}
