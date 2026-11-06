/* Measurement wrappers for the settings benchmark. They pass every call
   through unchanged (same inputs, same outputs) and only record timing and
   sizes. Prompt and answer text are never stored, only their lengths. */
import { AsyncLocalStorage } from 'node:async_hooks';
import z from 'zod';
import BaseLLM from '@/lib/models/base/llm';
import BaseEmbedding from '@/lib/models/base/embedding';
import {
  GenerateObjectInput,
  GenerateTextInput,
  GenerateTextOutput,
  StreamTextOutput,
} from '@/lib/models/types';
import { Chunk } from '@/lib/types';

export type LLMCallStat = {
  kind: 'generateText' | 'streamText' | 'generateObject' | 'streamObject';
  startMs: number;
  ms: number;
  firstChunkMs?: number;
  inputChars: number;
  outputChars: number;
  error?: string;
};

export type EmbeddingCallStat = {
  startMs: number;
  ms: number;
  texts: number;
  chars: number;
  error?: string;
};

export type HttpStat = {
  target: 'searxng' | 'firecrawl' | 'model' | 'other';
  host: string;
  startMs: number;
  ms: number;
  status: number | null;
  error?: string;
};

export type Recorder = {
  t0: number;
  llm: LLMCallStat[];
  embedding: EmbeddingCallStat[];
  http: HttpStat[];
};

export const newRecorder = (): Recorder => ({
  t0: performance.now(),
  llm: [],
  embedding: [],
  http: [],
});

const since = (r: Recorder, t: number) => Math.round(t - r.t0);
const msgChars = (input: GenerateTextInput | GenerateObjectInput) =>
  input.messages.reduce(
    (n, m) => n + (typeof m.content === 'string' ? m.content.length : 0),
    0,
  );

export class InstrumentedLLM extends BaseLLM<{ inner: BaseLLM<any> }> {
  constructor(
    private inner: BaseLLM<any>,
    private rec: Recorder,
  ) {
    super({ inner });
  }

  private async timed<T>(
    kind: LLMCallStat['kind'],
    input: any,
    fn: () => Promise<T>,
    size: (v: T) => number,
  ) {
    const start = performance.now();
    const stat: LLMCallStat = {
      kind,
      startMs: since(this.rec, start),
      ms: 0,
      inputChars: msgChars(input),
      outputChars: 0,
    };
    try {
      const out = await fn();
      stat.outputChars = size(out);
      return out;
    } catch (err: any) {
      stat.error = String(err?.message ?? err).slice(0, 300);
      throw err;
    } finally {
      stat.ms = Math.round(performance.now() - start);
      this.rec.llm.push(stat);
    }
  }

  generateText(input: GenerateTextInput): Promise<GenerateTextOutput> {
    return this.timed(
      'generateText',
      input,
      () => this.inner.generateText(input),
      (o) => o.content?.length ?? 0,
    );
  }

  generateObject<T>(input: GenerateObjectInput): Promise<z.infer<T>> {
    return this.timed(
      'generateObject',
      input,
      () => this.inner.generateObject<T>(input),
      (o) => JSON.stringify(o ?? '').length,
    );
  }

  async *streamText(
    input: GenerateTextInput,
  ): AsyncGenerator<StreamTextOutput> {
    yield* this.stream(
      'streamText',
      input,
      this.inner.streamText(input),
      (c: StreamTextOutput) => c.contentChunk?.length ?? 0,
    );
  }

  async *streamObject<T>(
    input: GenerateObjectInput,
  ): AsyncGenerator<Partial<z.infer<T>>> {
    let last = 0;
    yield* this.stream(
      'streamObject',
      input,
      this.inner.streamObject<T>(input),
      (c: any) => {
        const len = JSON.stringify(c ?? '').length;
        const delta = Math.max(0, len - last);
        last = len;
        return delta;
      },
    );
  }

  private async *stream<C>(
    kind: LLMCallStat['kind'],
    input: any,
    gen: AsyncGenerator<C>,
    size: (c: C) => number,
  ): AsyncGenerator<C> {
    const start = performance.now();
    const stat: LLMCallStat = {
      kind,
      startMs: since(this.rec, start),
      ms: 0,
      inputChars: msgChars(input),
      outputChars: 0,
    };
    try {
      for await (const chunk of gen) {
        if (stat.firstChunkMs === undefined)
          stat.firstChunkMs = Math.round(performance.now() - start);
        stat.outputChars += size(chunk);
        yield chunk;
      }
    } catch (err: any) {
      stat.error = String(err?.message ?? err).slice(0, 300);
      throw err;
    } finally {
      stat.ms = Math.round(performance.now() - start);
      this.rec.llm.push(stat);
    }
  }
}

export class InstrumentedEmbedding extends BaseEmbedding<{
  inner: BaseEmbedding<any>;
}> {
  constructor(
    private inner: BaseEmbedding<any>,
    private rec: Recorder,
  ) {
    super({ inner });
  }

  private async timed(texts: string[], fn: () => Promise<number[][]>) {
    const start = performance.now();
    const stat: EmbeddingCallStat = {
      startMs: since(this.rec, start),
      ms: 0,
      texts: texts.length,
      chars: texts.reduce((n, t) => n + t.length, 0),
    };
    try {
      return await fn();
    } catch (err: any) {
      stat.error = String(err?.message ?? err).slice(0, 300);
      throw err;
    } finally {
      stat.ms = Math.round(performance.now() - start);
      this.rec.embedding.push(stat);
    }
  }

  embedText(texts: string[]) {
    return this.timed(texts, () => this.inner.embedText(texts));
  }

  embedChunks(chunks: Chunk[]) {
    return this.timed(
      chunks.map((c) => c.content),
      () => this.inner.embedChunks(chunks),
    );
  }
}

/* HTTP tracing. fetch is wrapped once per process; a request is recorded
   only when it runs inside withHttpTrace(), so other users' requests are
   untouched and unrecorded. Only host, status and time are kept. */
const traceStore = new AsyncLocalStorage<{
  rec: Recorder;
  classify: (url: URL) => HttpStat['target'];
}>();
let fetchPatched = false;

const patchFetch = () => {
  if (fetchPatched) return;
  fetchPatched = true;
  const original = globalThis.fetch;
  globalThis.fetch = (async (input: any, init?: any) => {
    const ctx = traceStore.getStore();
    if (!ctx) return original(input, init);
    let url: URL | null = null;
    try {
      url = new URL(
        typeof input === 'string'
          ? input
          : input instanceof URL
            ? input.href
            : input.url,
      );
    } catch {}
    const start = performance.now();
    const stat: HttpStat = {
      target: url ? ctx.classify(url) : 'other',
      host: url?.host ?? '?',
      startMs: since(ctx.rec, start),
      ms: 0,
      status: null,
    };
    try {
      const res = await original(input, init);
      stat.status = res.status;
      return res;
    } catch (err: any) {
      stat.error = String(
        err?.name === 'AbortError' ? 'timeout/abort' : (err?.message ?? err),
      ).slice(0, 200);
      throw err;
    } finally {
      stat.ms = Math.round(performance.now() - start);
      ctx.rec.http.push(stat);
    }
  }) as typeof fetch;
};

export const withHttpTrace = <T>(
  rec: Recorder,
  urls: { searxng?: string; firecrawl?: string },
  fn: () => Promise<T>,
): Promise<T> => {
  patchFetch();
  const prefix = (u?: string) => {
    try {
      return u ? new URL(u).host : null;
    } catch {
      return null;
    }
  };
  const searxng = prefix(urls.searxng);
  const firecrawl = prefix(urls.firecrawl);
  const classify = (url: URL): HttpStat['target'] => {
    if (searxng && url.host === searxng) return 'searxng';
    if (firecrawl && url.host === firecrawl) return 'firecrawl';
    if (
      /\/(chat\/completions|embeddings|responses|api\/chat|api\/embed)/.test(
        url.pathname,
      )
    )
      return 'model';
    return 'other';
  };
  return traceStore.run({ rec, classify }, fn);
};
