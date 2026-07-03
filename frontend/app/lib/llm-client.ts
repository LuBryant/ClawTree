/**
 * Same-origin streaming client. Provider credentials stay on the server.
 */
const ASSISTANT_ENDPOINT = '/api/assistant/chat';
const ASSISTANT_TIMEOUT_MS = 60_000;

interface StreamResult {
  content: string | null;
}

class AssistantClient {
  /** Streams assistant text from the fixed same-origin endpoint. */
  async streamChat(
    messages: Array<{ role: 'user' | 'assistant'; content: string }>,
    callbacks?: {
      onChunk?: (text: string) => void;
    },
  ): Promise<StreamResult> {
    const body = { messages };

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

      const reader = response.body!.getReader();
      const decoder = new TextDecoder();
      let content = '';

      let buf = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split('\n');
        buf = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || !trimmed.startsWith('data:')) continue;
          const dataStr = trimmed.slice(5).trim();
          if (dataStr === '[DONE]') continue;

          try {
            const parsed = JSON.parse(dataStr);
            const delta = parsed.choices?.[0]?.delta;
            if (!delta) continue;

            if (delta.content) {
              content += delta.content;
              callbacks?.onChunk?.(delta.content);
            }

          } catch { /* skip unparseable line */ }
        }
      }

      return { content: content || null };
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
