import crypto from 'crypto';
import { ModelList } from './types';

/**
 * Short-lived cache for the model lists that providers fetch over HTTP
 * (LM Studio /v1/models, Ollama /api/tags, Anthropic, Gemini, Groq...).
 *
 * Every request builds a new ModelRegistry, and loading a model checks it
 * against the provider's list, so without this each chat message paid one
 * GET per model loaded before its stream could open.
 *
 * Entries are keyed by provider id plus a hash of the provider config, so a
 * changed URL or key never reads an old list. Failures are not cached, and
 * concurrent callers share one in-flight request.
 */

const DEFAULT_TTL_MS = 60_000;
const DEFAULT_FETCH_TIMEOUT_MS = 10_000;

const readMs = (raw: string | undefined, fallback: number) => {
  if (raw === undefined || raw.trim() === '') return fallback;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
};

/** How long a fetched list is reused. 0 disables the cache. */
export const modelListTTL = () =>
  readMs(process.env.MODEL_LIST_CACHE_TTL_MS, DEFAULT_TTL_MS);

/** Abort signal for a provider's model-list GET (MODEL_LIST_TIMEOUT_MS). */
export const modelListSignal = () =>
  AbortSignal.timeout(
    readMs(process.env.MODEL_LIST_TIMEOUT_MS, DEFAULT_FETCH_TIMEOUT_MS) ||
      DEFAULT_FETCH_TIMEOUT_MS,
  );

type Entry = {
  providerId: string;
  expiresAt: number;
  value?: ModelList;
  pending?: Promise<ModelList>;
};

/* Kept on globalThis so Next's dev reloads and separate route bundles share it. */
const globalStore = globalThis as unknown as {
  __vaneModelListCache?: Map<string, Entry>;
};
const store = (globalStore.__vaneModelListCache ??= new Map<string, Entry>());

const cacheKey = (providerId: string, config: unknown) =>
  `${providerId}:${crypto
    .createHash('sha256')
    .update(JSON.stringify(config ?? null))
    .digest('hex')}`;

export const getCachedModelList = async (
  providerId: string,
  config: unknown,
  load: () => Promise<ModelList>,
  opts: { fresh?: boolean } = {},
): Promise<ModelList> => {
  const ttl = modelListTTL();
  const key = cacheKey(providerId, config);
  const now = Date.now();
  const hit = store.get(key);

  if (!opts.fresh && ttl > 0 && hit) {
    if (hit.pending) return hit.pending;
    if (hit.value && hit.expiresAt > now) return hit.value;
  }

  const pending = load().then(
    (value) => {
      if (store.get(key)?.pending === pending) {
        if (ttl > 0) {
          store.set(key, { providerId, value, expiresAt: Date.now() + ttl });
        } else {
          store.delete(key);
        }
      }
      return value;
    },
    (err) => {
      if (store.get(key)?.pending === pending) store.delete(key);
      throw err;
    },
  );

  store.set(key, { providerId, expiresAt: 0, pending });
  return pending;
};

/** Drops cached lists for one provider, or for all providers. */
export const invalidateModelListCache = (providerId?: string) => {
  if (providerId === undefined) {
    store.clear();
    return;
  }
  for (const [key, entry] of store) {
    if (entry.providerId === providerId) store.delete(key);
  }
};
