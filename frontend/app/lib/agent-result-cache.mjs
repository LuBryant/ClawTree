import { createHash } from 'node:crypto';

function canonicalize(value) {
  if (Array.isArray(value)) return value.map((item) => canonicalize(item));
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([, item]) => item !== undefined)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, item]) => [key, canonicalize(item)]),
    );
  }
  return value;
}

function clone(value) {
  return structuredClone(value);
}

export function stableJson(value) {
  return JSON.stringify(canonicalize(value));
}

export function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

export function createAgentCacheIdentity({ request, schemaVersion, modelVersion }) {
  const inputContentHash = sha256(stableJson(request.input ?? request));
  const cacheKey = sha256(stableJson({
    task: request.task ?? 'unknown',
    inputContentHash,
    schemaVersion,
    modelVersion,
  }));
  return { inputContentHash, cacheKey, schemaVersion, modelVersion };
}

export class AgentResultCache {
  #entries = new Map();
  #inflight = new Map();

  constructor({ maxEntries = 500, ttlMs = 6 * 60 * 60 * 1000, now = Date.now } = {}) {
    this.maxEntries = maxEntries;
    this.ttlMs = ttlMs;
    this.now = now;
  }

  clear() {
    this.#entries.clear();
    this.#inflight.clear();
  }

  get(key) {
    const entry = this.#entries.get(key);
    if (!entry) return undefined;
    if (entry.expiresAt <= this.now()) {
      this.#entries.delete(key);
      return undefined;
    }
    this.#entries.delete(key);
    this.#entries.set(key, entry);
    return clone(entry.value);
  }

  set(key, value) {
    this.#entries.delete(key);
    this.#entries.set(key, { value: clone(value), expiresAt: this.now() + this.ttlMs });
    while (this.#entries.size > this.maxEntries) {
      const oldest = this.#entries.keys().next().value;
      if (oldest === undefined) break;
      this.#entries.delete(oldest);
    }
  }

  async getOrCompute(key, compute) {
    const cached = this.get(key);
    if (cached !== undefined) return { value: cached, cacheHit: true };

    const existing = this.#inflight.get(key);
    if (existing) return { value: clone(await existing), cacheHit: true };

    const pending = Promise.resolve().then(compute);
    this.#inflight.set(key, pending);
    try {
      const value = await pending;
      this.set(key, value);
      return { value: clone(value), cacheHit: false };
    } finally {
      this.#inflight.delete(key);
    }
  }
}

const globalCacheKey = Symbol.for('clawtree.agent-result-cache.v1');
const globalScope = globalThis;

export function globalAgentResultCache() {
  if (!globalScope[globalCacheKey]) globalScope[globalCacheKey] = new AgentResultCache();
  return globalScope[globalCacheKey];
}

export function clearGlobalAgentResultCacheForTests() {
  globalAgentResultCache().clear();
}
