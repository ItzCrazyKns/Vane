import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/config/serverRegistry', () => ({
  getConfiguredModelProviderById: () => ({
    chatModels: [],
    embeddingModels: [],
  }),
}));

import {
  getCachedModelList,
  invalidateModelListCache,
} from '@/lib/models/modelListCache';
import LMStudioProvider from '@/lib/models/providers/lmstudio';
import OllamaProvider from '@/lib/models/providers/ollama';

const list = (...keys: string[]) => ({
  chat: keys.map((k) => ({ key: k, name: k })),
  embedding: keys.map((k) => ({ key: k, name: k })),
});

beforeEach(() => invalidateModelListCache());
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe('getCachedModelList', () => {
  it('reuses one list within the TTL and shares the in-flight request', async () => {
    const load = vi.fn(async () => list('a'));

    const [a, b] = await Promise.all([
      getCachedModelList('p', { url: 'x' }, load),
      getCachedModelList('p', { url: 'x' }, load),
    ]);
    await getCachedModelList('p', { url: 'x' }, load);

    expect(a).toEqual(list('a'));
    expect(b).toEqual(list('a'));
    expect(load).toHaveBeenCalledTimes(1);
  });

  it('expires after the TTL', async () => {
    vi.useFakeTimers();
    const load = vi.fn(async () => list('a'));

    await getCachedModelList('p', {}, load);
    vi.advanceTimersByTime(60_001);
    await getCachedModelList('p', {}, load);

    expect(load).toHaveBeenCalledTimes(2);
  });

  it('keys on the provider config, so a changed config refetches', async () => {
    const load = vi.fn(async () => list('a'));

    await getCachedModelList('p', { url: 'one' }, load);
    await getCachedModelList('p', { url: 'two' }, load);

    expect(load).toHaveBeenCalledTimes(2);
  });

  it('does not cache failures', async () => {
    const load = vi
      .fn<() => Promise<ReturnType<typeof list>>>()
      .mockRejectedValueOnce(new Error('down'))
      .mockResolvedValueOnce(list('a'));

    await expect(getCachedModelList('p', {}, load)).rejects.toThrow('down');
    await expect(getCachedModelList('p', {}, load)).resolves.toEqual(list('a'));
  });

  it('honours fresh, invalidation and MODEL_LIST_CACHE_TTL_MS=0', async () => {
    const load = vi.fn(async () => list('a'));

    await getCachedModelList('p', {}, load);
    await getCachedModelList('p', {}, load, { fresh: true });
    expect(load).toHaveBeenCalledTimes(2);

    invalidateModelListCache('p');
    await getCachedModelList('p', {}, load);
    expect(load).toHaveBeenCalledTimes(3);

    vi.stubEnv('MODEL_LIST_CACHE_TTL_MS', '0');
    await getCachedModelList('p', {}, load);
    await getCachedModelList('p', {}, load);
    expect(load).toHaveBeenCalledTimes(5);
  });
});

describe('providers load models through the cache', () => {
  it('LM Studio: one GET for chat + embedding, with a timeout signal', async () => {
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) =>
      Response.json({ data: [{ id: 'chat' }, { id: 'emb' }] }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const provider = new LMStudioProvider('lms', 'LM Studio', {
      baseURL: 'http://host:1234',
    });

    for (let i = 0; i < 3; i++) {
      await Promise.all([
        provider.loadChatModel('chat'),
        provider.loadEmbeddingModel('emb'),
      ]);
    }

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe('http://host:1234/v1/models');
    expect(fetchMock.mock.calls[0][1]?.signal).toBeInstanceOf(AbortSignal);
  });

  it('refetches once when the model is not in the cached list', async () => {
    let models = [{ name: 'old', model: 'old' }];
    const fetchMock = vi.fn(async () => Response.json({ models }));
    vi.stubGlobal('fetch', fetchMock);

    const provider = new OllamaProvider('oll', 'Ollama', {
      baseURL: 'http://host:11434',
    });

    await provider.loadChatModel('old');
    models = [...models, { name: 'new', model: 'new' }];
    await expect(provider.loadChatModel('new')).resolves.toBeDefined();
    await expect(provider.loadChatModel('missing')).rejects.toThrow(
      /Invalid Model Selected/,
    );

    /* 1 initial + 1 refresh for "new" + 1 refresh for "missing". */
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });
});
