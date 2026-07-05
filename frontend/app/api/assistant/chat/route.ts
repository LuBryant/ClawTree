import {
  buildAssistantSystemPrompt,
  buildAssistantRagPrompt,
} from '../../../lib/assistant-prompt.server';
import { getWorkspace } from '../../../config/workspaces';
import {
  answerPassesGuardrails,
  type AssistantCitation,
  assistantHandoffUrl,
  retrieveAssistantKnowledge,
  type AssistantAudience,
  type AssistantRetrieval,
} from '../../../lib/assistant-rag.server';
import {
  buildAssistantWebSearchContext,
  buildWebSearchFallbackAnswer,
  searchAssistantWeb,
  shouldUseAssistantWebSearch,
  webSearchToCitations,
} from '../../../lib/assistant-web-search.server';

export const runtime = 'nodejs';

type ChatMessage = { role: 'user' | 'assistant'; content: string };

const MAX_MESSAGES = 20;
const MAX_MESSAGE_CHARS = 4_000;
const MAX_TOTAL_CHARS = 20_000;
const DEFAULT_BASE_URL = 'https://api.deepseek.com';
const ALLOWED_PROVIDER_HOSTS = new Set(['api.deepseek.com']);

type AssistantResponseMode =
  | 'rag_model'
  | 'ai_model'
  | 'web_search_model'
  | 'web_search_fallback'
  | 'faq_fallback'
  | 'policy_refusal';

function errorResponse(error: string, status: number) {
  return Response.json({ error }, { status, headers: { 'cache-control': 'no-store' } });
}

function answerResponse(
  retrieval: AssistantRetrieval,
  mode: AssistantResponseMode,
  answer = retrieval.answer,
  extraCitations: AssistantCitation[] = [],
) {
  const citations = [...retrieval.citations, ...extraCitations]
    .filter((citation, index, all) => all.findIndex((item) => item.id === citation.id) === index);
  return Response.json({
    answer,
    mode,
    decision: retrieval.decision,
    grounded: citations.length > 0,
    knowledgeAsOf: retrieval.knowledgeAsOf,
    citations,
    handoff: {
      required: retrieval.handoffRequired,
      reason: retrieval.handoffReason,
      url: assistantHandoffUrl,
    },
    externalSideEffect: false,
  }, { headers: { 'cache-control': 'no-store' } });
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

function detectResponseLanguage(text: string, fallback: 'zh' | 'en'): 'zh' | 'en' {
  const hanCount = text.match(/\p{Script=Han}/gu)?.length ?? 0;
  const latinCount = text.match(/[A-Za-z]/g)?.length ?? 0;
  if (hanCount > 0) return 'zh';
  if (latinCount > 0) return 'en';
  return fallback;
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
  const bodyRecord = body && typeof body === 'object' ? body as Record<string, unknown> : null;
  const messages = validateMessages(bodyRecord?.messages);
  if (!messages) return errorResponse('invalid_messages', 400);

  const audience: AssistantAudience = bodyRecord?.audience === 'student' ? 'student' : 'teacher';
  const preferredLanguage = bodyRecord?.language === 'en' ? 'en' : 'zh';
  const workspace = getWorkspace(typeof bodyRecord?.workspaceSlug === 'string' ? bodyRecord.workspaceSlug : undefined);
  if (!workspace) return errorResponse('workspace_not_found', 404);
  const latestUserMessage = messages.at(-1);
  if (!latestUserMessage || latestUserMessage.role !== 'user') return errorResponse('invalid_messages', 400);
  const language = detectResponseLanguage(latestUserMessage.content, preferredLanguage);
  const retrieval = retrieveAssistantKnowledge(latestUserMessage.content, audience, language);

  if (retrieval.decision !== 'answer') {
    return answerResponse(retrieval, 'policy_refusal');
  }

  const shouldSearchWeb = shouldUseAssistantWebSearch(latestUserMessage.content);
  const webSearch = shouldSearchWeb ? await searchAssistantWeb(latestUserMessage.content, language) : null;
  const webCitations = webSearch ? webSearchToCitations(webSearch) : [];
  const groundingContext = [
    retrieval.context,
    webSearch ? buildAssistantWebSearchContext(webSearch, language) : '',
  ].filter(Boolean).join('\n\n');

  const apiKey = process.env.ASSISTANT_FORCE_FALLBACK === '1'
    ? undefined
    : process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    if (shouldSearchWeb) {
      return answerResponse(
        retrieval,
        'web_search_fallback',
        buildWebSearchFallbackAnswer(retrieval.answer, webSearch, language),
        webCitations,
      );
    }
    return answerResponse(retrieval, 'faq_fallback');
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 60_000);
  try {
    const upstream = await fetch(new URL('/chat/completions', providerBaseUrl()), {
      method: 'POST',
      headers: { authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        model: process.env.DEEPSEEK_MODEL || 'deepseek-chat',
        messages: [
          { role: 'system', content: buildAssistantSystemPrompt(workspace) },
          ...messages.slice(0, -1).slice(-6),
          { role: 'user', content: buildAssistantRagPrompt(latestUserMessage.content, groundingContext, language) },
        ],
        stream: false,
        temperature: 0.1,
        max_tokens: shouldSearchWeb ? 900 : 700,
      }),
      cache: 'no-store',
      signal: controller.signal,
    });
    if (!upstream.ok) {
      clearTimeout(timeout);
      if (shouldSearchWeb) {
        return answerResponse(
          retrieval,
          'web_search_fallback',
          buildWebSearchFallbackAnswer(retrieval.answer, webSearch, language),
          webCitations,
        );
      }
      return answerResponse(retrieval, 'faq_fallback');
    }
    const payload = await upstream.json();
    clearTimeout(timeout);
    const answer = payload?.choices?.[0]?.message?.content;
    if (typeof answer !== 'string' || !answer.trim() || !answerPassesGuardrails(answer)) {
      if (shouldSearchWeb) {
        return answerResponse(
          retrieval,
          'web_search_fallback',
          buildWebSearchFallbackAnswer(retrieval.answer, webSearch, language),
          webCitations,
        );
      }
      return answerResponse(retrieval, 'faq_fallback');
    }
    return answerResponse(
      retrieval,
      shouldSearchWeb ? 'web_search_model' : retrieval.citations.length > 0 ? 'rag_model' : 'ai_model',
      answer.trim(),
      webCitations,
    );
  } catch {
    clearTimeout(timeout);
    if (shouldSearchWeb) {
      return answerResponse(
        retrieval,
        'web_search_fallback',
        buildWebSearchFallbackAnswer(retrieval.answer, webSearch, language),
        webCitations,
      );
    }
    return answerResponse(retrieval, 'faq_fallback');
  }
}
