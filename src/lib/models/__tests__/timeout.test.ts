import { afterEach, describe, expect, it, vi } from 'vitest';
import OpenAILLM from '@/lib/models/providers/openai/openaiLLM';
import LMStudioLLM from '@/lib/models/providers/lmstudio/lmstudioLLM';
import OllamaLLM from '@/lib/models/providers/ollama/ollamaLLM';
import {
  DEFAULT_LLM_TIMEOUT_MS,
  fetchWithHeadersTimeout,
  llmTimeoutMs,
} from '@/lib/models/utils/timeout';

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

/* A server that never answers, but honours the abort signal. */
const hangingFetch = vi.fn(
  (_input: any, init?: RequestInit) =>
    new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () =>
        reject(init.signal!.reason),
      );
    }),
);

describe('LLM_TIMEOUT_MS', () => {
  it('defaults to 5 minutes and ignores invalid values', () => {
    expect(llmTimeoutMs()).toBe(DEFAULT_LLM_TIMEOUT_MS);
    vi.stubEnv('LLM_TIMEOUT_MS', 'abc');
    expect(llmTimeoutMs()).toBe(DEFAULT_LLM_TIMEOUT_MS);
    vi.stubEnv('LLM_TIMEOUT_MS', '0');
    expect(llmTimeoutMs()).toBe(DEFAULT_LLM_TIMEOUT_MS);
    vi.stubEnv('LLM_TIMEOUT_MS', '900000');
    expect(llmTimeoutMs()).toBe(900000);
  });

  it('sets the OpenAI-compatible and LM Studio client timeout', () => {
    vi.stubEnv('LLM_TIMEOUT_MS', '1234');
    const cfg = { apiKey: 'k', model: 'm', baseURL: 'http://h/v1' };

    expect(new OpenAILLM(cfg).openAIClient.timeout).toBe(1234);
    expect(new LMStudioLLM(cfg).openAIClient.timeout).toBe(1234);
  });

  it('aborts an Ollama call whose headers do not arrive in time', async () => {
    vi.stubEnv('LLM_TIMEOUT_MS', '50');
    vi.stubGlobal('fetch', hangingFetch);

    const llm = new OllamaLLM({ baseURL: 'http://ollama', model: 'm' });

    await expect(
      llm.generateText({ messages: [{ role: 'user', content: 'hi' }] }),
    ).rejects.toThrow(/timed out after 50 ms/);
  });
});

describe('fetchWithHeadersTimeout', () => {
  it('does not cut the body once headers arrived', async () => {
    let signal: AbortSignal | undefined;
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_i: any, init?: RequestInit) => {
        signal = init?.signal ?? undefined;
        return new Response('ok');
      }),
    );

    const res = await fetchWithHeadersTimeout(20)('http://x');
    await new Promise((r) => setTimeout(r, 40));

    expect(signal?.aborted).toBe(false);
    expect(await res.text()).toBe('ok');
  });

  it("keeps the caller's abort signal", async () => {
    vi.stubGlobal('fetch', hangingFetch);
    const caller = new AbortController();

    const pending = fetchWithHeadersTimeout(60_000)('http://x', {
      signal: caller.signal,
    });
    caller.abort(new Error('user abort'));

    await expect(pending).rejects.toThrow('user abort');
  });
});
