import { afterEach, describe, expect, it, vi } from 'vitest';
import LMStudioLLM from '@/lib/models/providers/lmstudio/lmstudioLLM';

const make = () =>
  new LMStudioLLM({
    apiKey: 'lm-studio',
    model: 'qwen/qwen3.6-27b',
    baseURL: 'http://host:1234/v1',
  });

describe('LMStudioLLM.getContextWindow', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('reads the loaded context from /api/v0/models/{model}, once', async () => {
    const fetchMock = vi.fn(async (_url: string) =>
      Response.json({
        loaded_context_length: 16384,
        max_context_length: 262144,
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const llm = make();
    expect(await llm.getContextWindow()).toBe(16384);
    expect(await llm.getContextWindow()).toBe(16384);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe(
      'http://host:1234/api/v0/models/qwen%2Fqwen3.6-27b',
    );
  });

  it('falls back to max_context_length, and to undefined on errors', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Response.json({ max_context_length: 32768 })),
    );
    expect(await make().getContextWindow()).toBe(32768);

    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new TypeError('refused');
      }),
    );
    expect(await make().getContextWindow()).toBeUndefined();
  });
});
