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
import {
  TraceEvent,
  Usage,
  currentTraceLabel,
  withUsageSink,
} from '@/lib/trace';

export type LLMCallStat = {
  kind: 'generateText' | 'streamText' | 'generateObject' | 'streamObject';
  /** What the call was for (classifier, widget, researcher, writer...). */
  label?: string;
  startMs: number;
  ms: number;
  firstChunkMs?: number;
  inputChars: number;
  outputChars: number;
  /** What the server reported, when it did (see lib/trace Usage). */
  usage?: Usage;
  error?: string;
};

/* Fields a provider reported for the call; later reports fill in or
   replace earlier ones (a stream's usage chunk, then its reasoning). */
const usageSink = (stat: LLMCallStat) => (u: Usage) => {
  const clean = Object.fromEntries(
    Object.entries(u).filter(([, v]) => typeof v === 'number'),
  );
  if (Object.keys(clean).length) stat.usage = { ...stat.usage, ...clean };
};

export type EmbeddingCallStat = {
  startMs: number;
  ms: number;
  texts: number;
  chars: number;
  error?: string;
};

export type HttpStat = {
  target:
    | 'searxng'
    | 'firecrawl-search'
    | 'firecrawl-scrape'
    | 'firecrawl'
    | 'bifrost'
    | 'model'
    | 'other';
  host: string;
  /** URL path without the query string. */
  path?: string;
  contentType?: string;
  /** From Content-Length; the body is never read. */
  bytes?: number;
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
  /** Search funnel counts reported through lib/trace. */
  events: TraceEvent[];
};

export const newRecorder = (): Recorder => ({
  t0: performance.now(),
  llm: [],
  embedding: [],
  http: [],
  events: [],
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

  /* Without this the search code would budget for the default window
     instead of the one the real model reports (LM Studio, Ollama). */
  getContextWindow() {
    return this.inner.getContextWindow();
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
      label: currentTraceLabel(),
      startMs: since(this.rec, start),
      ms: 0,
      inputChars: msgChars(input),
      outputChars: 0,
    };
    try {
      const out = await withUsageSink(usageSink(stat), fn);
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

  /* Not generators themselves: the label is read when the call is made,
     not when the caller first pulls a chunk (by then the labelled scope may
     be gone). */
  streamText(input: GenerateTextInput): AsyncGenerator<StreamTextOutput> {
    return this.stream(
      'streamText',
      currentTraceLabel(),
      input,
      this.inner.streamText(input),
      (c: StreamTextOutput) => c.contentChunk?.length ?? 0,
    );
  }

  streamObject<T>(
    input: GenerateObjectInput,
  ): AsyncGenerator<Partial<z.infer<T>>> {
    let last = 0;
    return this.stream(
      'streamObject',
      currentTraceLabel(),
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
    label: string | undefined,
    input: any,
    gen: AsyncGenerator<C>,
    size: (c: C) => number,
  ): AsyncGenerator<C> {
    const start = performance.now();
    const stat: LLMCallStat = {
      kind,
      label,
      startMs: since(this.rec, start),
      ms: 0,
      inputChars: msgChars(input),
      outputChars: 0,
    };
    /* Each step of the provider's stream runs inside the usage sink, so the
       usage it reports lands on this call even with others in parallel. */
    const sink = usageSink(stat);
    let finished = false;
    try {
      while (true) {
        const step = await withUsageSink(sink, () => gen.next());
        if (step.done) {
          finished = true;
          break;
        }
        if (stat.firstChunkMs === undefined)
          stat.firstChunkMs = Math.round(performance.now() - start);
        stat.outputChars += size(step.value);
        yield step.value;
      }
    } catch (err: any) {
      finished = true;
      stat.error = String(err?.message ?? err).slice(0, 300);
      throw err;
    } finally {
      /* The consumer stopped early: let the provider close its stream. */
      if (!finished) await gen.return?.(undefined as any);
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
   untouched and unrecorded. Only host, path, status, content type, size
   and time are kept; never the query string, headers or body. */
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
      path: url?.pathname,
      startMs: since(ctx.rec, start),
      ms: 0,
      status: null,
    };
    try {
      const res = await original(input, init);
      stat.status = res.status;
      const type = res.headers.get('content-type');
      if (type) stat.contentType = type.split(';')[0].trim();
      const len = Number(res.headers.get('content-length'));
      if (Number.isFinite(len) && len > 0) stat.bytes = len;
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

export type TraceURLs = {
  searxng?: string;
  firecrawl?: string;
  bifrost?: string;
};

/* By host and path, so a search and a page read on the same Firecrawl are
   told apart, and so are SearXNG and Bifrost when they share a host. */
export const classifyURL =
  (urls: TraceURLs) =>
  (url: URL): HttpStat['target'] => {
    const host = (u?: string) => {
      try {
        return u ? new URL(u).host : null;
      } catch {
        return null;
      }
    };
    const searxng = host(urls.searxng);
    const firecrawl = host(urls.firecrawl);
    const bifrost = host(urls.bifrost);
    const p = url.pathname;
    if (
      /\/(chat\/completions|embeddings|responses|api\/chat|api\/embed)/.test(p)
    )
      return 'model';
    if (bifrost && url.host === bifrost && /^\/mcp(\/|$)/.test(p))
      return 'bifrost';
    if (searxng && url.host === searxng) return 'searxng';
    if (firecrawl && url.host === firecrawl) {
      if (/\/search$/.test(p)) return 'firecrawl-search';
      if (/\/scrape$/.test(p)) return 'firecrawl-scrape';
      return 'firecrawl';
    }
    return 'other';
  };

export const withHttpTrace = <T>(
  rec: Recorder,
  urls: TraceURLs,
  fn: () => Promise<T>,
): Promise<T> => {
  patchFetch();
  const classify = classifyURL(urls);
  return traceStore.run({ rec, classify }, fn);
};
