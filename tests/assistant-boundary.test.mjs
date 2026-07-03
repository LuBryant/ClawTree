import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const clientSource = await readFile(
  new URL('../frontend/app/lib/llm-client.ts', import.meta.url),
  'utf8',
);
const proxySource = await readFile(
  new URL('../frontend/app/api/assistant/chat/route.ts', import.meta.url),
  'utf8',
);

test('browser assistant uses only the same-origin proxy', () => {
  assert.match(clientSource, /['"]\/api\/assistant\/chat['"]/);
  assert.doesNotMatch(clientSource, /api\.deepseek\.com/);
  assert.doesNotMatch(clientSource, /DEEPSEEK_API_KEY/);
  assert.doesNotMatch(clientSource, /authorization/i);
});

test('assistant provider credential is read only by the server route', () => {
  assert.match(proxySource, /process\.env\.DEEPSEEK_API_KEY/);
  assert.doesNotMatch(proxySource, /NEXT_PUBLIC_/);
  assert.match(proxySource, /candidate\.role !== 'user'.*candidate\.role !== 'assistant'/s);
});
