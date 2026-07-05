/** Same-origin assistant client. Provider credentials and RAG context stay on the server. */
const ASSISTANT_ENDPOINT = '/api/assistant/chat';
const ASSISTANT_TIMEOUT_MS = 60_000;

export type AssistantCitation = {
  id: string;
  title: string;
  label: string;
  url: string;
  checkedAt: string;
};

interface StreamResult {
  content: string | null;
  mode: 'rag_model' | 'ai_model' | 'web_search_model' | 'web_search_fallback' | 'faq_fallback' | 'policy_refusal';
  decision: 'answer' | 'refuse' | 'handoff';
  grounded: boolean;
  knowledgeAsOf: string;
  citations: AssistantCitation[];
  handoff: { required: boolean; reason: string | null; url: string };
}

class AssistantClient {
  /** Requests a grounded answer from the fixed same-origin endpoint. */
  async streamChat(
    messages: Array<{ role: 'user' | 'assistant'; content: string }>,
    options?: {
      audience?: 'teacher' | 'student';
      language?: 'zh' | 'en';
      workspaceSlug?: string;
      onChunk?: (text: string) => void;
    },
  ): Promise<StreamResult> {
    const body = {
      messages,
      audience: options?.audience || 'teacher',
      language: options?.language || 'zh',
      workspaceSlug: options?.workspaceSlug || 'treefinance',
    };

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), ASSISTANT_TIMEOUT_MS);

    try {
      const response = await fetch(ASSISTANT_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`assistant_unavailable:${response.status}`);
      }

      const payload = await response.json();
      if (typeof payload.answer !== 'string' || !Array.isArray(payload.citations)) {
        throw new Error('assistant_invalid_response');
      }
      options?.onChunk?.(payload.answer);
      return {
        content: payload.answer,
        mode: payload.mode,
        decision: payload.decision,
        grounded: Boolean(payload.grounded),
        knowledgeAsOf: payload.knowledgeAsOf,
        citations: payload.citations,
        handoff: payload.handoff,
      };
    } finally {
      clearTimeout(timer);
    }
  }
}

let _instance: AssistantClient | null = null;
export function getAssistantClient() {
  if (!_instance) _instance = new AssistantClient();
  return _instance;
}

export type { StreamResult };
