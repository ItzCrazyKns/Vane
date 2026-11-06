/* Measurements behind the search pipeline performance changes. They use
   the deterministic fakes and assert call counts and peak concurrency, so
   they are stable; the timings they print are informative only. */
import { describe, expect, it, vi } from 'vitest';
import {
  FakeEmbedding,
  FakeLLM,
  createFakeSession,
  embedDeterministic,
} from '@/__tests__/helpers/fakes';
import computeSimilarity from '@/lib/utils/computeSimilarity';

const VOCAB_TEXTS = [
  'rust web memory',
  'go goroutines concurrency',
  'rust async tokio',
  'web concurrency memory',
  'cooking recipes',
  'go web',
  'tokio async rust web',
  'memory memory rust',
];

/* 10 results per query, with contents drawn from the vocabulary so the
   similarity filter keeps some and drops others. */
const resultsFor = (q: string) =>
  Array.from({ length: 10 }, (_, i) => ({
    title: `${q} #${i}`,
    url: `https://${q.replace(/\W+/g, '-')}.test/${i}`,
    content: VOCAB_TEXTS[(q.length + i) % VOCAB_TEXTS.length],
  }));

vi.mock('@/lib/searxng', () => ({
  searchSearxng: vi.fn(async (q: string) => ({
    results: resultsFor(q),
    suggestions: [],
  })),
}));

const scrapeMock = vi.fn();
vi.mock('@/lib/scraper', () => ({
  default: { scrape: (url: string) => scrapeMock(url) },
}));

import {
  EXTRACTOR_CONCURRENCY,
  MAX_PAGE_CHARS,
  EMBEDDING_CONCURRENCY,
  executeSearch,
} from '../researcher/actions/search/baseSearch';

const newBlock = () => ({
  id: 'research',
  type: 'research' as const,
  data: { subSteps: [] as any[] },
});

/* Embedding fake that takes `delayMs` per request and records how many
   requests were in flight at once. */
class SlowEmbedding extends FakeEmbedding {
  inFlight = 0;
  peak = 0;
  constructor(private delayMs: number) {
    super();
  }
  async embedText(texts: string[]): Promise<number[][]> {
    this.inFlight += 1;
    this.peak = Math.max(this.peak, this.inFlight);
    try {
      await new Promise((r) => setTimeout(r, this.delayMs));
      return await super.embedText(texts);
    } finally {
      this.inFlight -= 1;
    }
  }
}

const QUERIES = [
  ['rust web', 'go concurrency', 'tokio async'],
  ['rust memory', 'go web', 'async rust'],
  ['web memory', 'goroutines', 'rust tokio'],
];

describe('search pipeline performance (speed/balanced embeddings)', () => {
  it('sends one embedding request per query, holding the query and its results', async () => {
    const embedding = new FakeEmbedding();
    await executeSearch({
      queries: QUERIES[0],
      mode: 'balanced',
      researchBlock: newBlock() as any,
      session: createFakeSession() as any,
      llm: new FakeLLM({}),
      embedding,
    });

    // 3 requests for 3 queries x 10 results (the old path sent 3 x (1 + 10)).
    expect(embedding.calls).toHaveLength(3);
    expect(embedding.calls.flat()).toHaveLength(3 * 11);
  });

  it('keeps the same relevance filter and dedup as the per-result embedding path', async () => {
    const queries = QUERIES[0];
    const results = await executeSearch({
      queries,
      mode: 'speed',
      researchBlock: newBlock() as any,
      session: createFakeSession() as any,
      llm: new FakeLLM({}),
      embedding: new FakeEmbedding(),
    });

    /* Old path: embed the query, then each result on its own. */
    const old = queries
      .flatMap((q) => {
        const qe = embedDeterministic(q);
        return resultsFor(q).map((r) => {
          const e = embedDeterministic(r.content);
          return { url: r.url, e, similarity: computeSimilarity(qe, e) };
        });
      })
      .filter((r) => r.similarity > 0.5)
      .sort((a, b) => b.similarity - a.similarity);
    const kept: typeof old = [];
    for (const r of old) {
      if (!kept.some((k) => computeSimilarity(k.e, r.e) > 0.75)) kept.push(r);
    }

    /* Order now comes from the hybrid ranking (RRF), and the dedup keeps
       the first of each near-duplicate group in that order, so compare
       the filter and the dedup rather than the exact list. */
    const passed = new Map(old.map((r) => [r.url, r.e]));
    const urls = results.map((r) => r.metadata.url);
    expect(urls).toHaveLength(Math.min(20, kept.length));
    urls.forEach((u) => expect(passed.has(u)).toBe(true));
    urls.forEach((u, i) =>
      urls
        .slice(i + 1)
        .forEach((v) =>
          expect(
            computeSimilarity(passed.get(u)!, passed.get(v)!),
          ).toBeLessThanOrEqual(0.75),
        ),
    );
  });

  it('caps embedding requests in flight across parallel searches', async () => {
    const embedding = new SlowEmbedding(20);
    const started = performance.now();

    /* Three search actions in the same iteration (web, academic,
       discussions), three queries each. */
    await Promise.all(
      QUERIES.map((queries) =>
        executeSearch({
          queries,
          mode: 'balanced',
          researchBlock: newBlock() as any,
          session: createFakeSession() as any,
          llm: new FakeLLM({}),
          embedding,
        }),
      ),
    );

    console.log(
      `[perf] embeddings: ${embedding.calls.length} requests, peak in flight ${embedding.peak}, ${(performance.now() - started).toFixed(0)} ms`,
    );
    expect(embedding.calls).toHaveLength(9);
    expect(embedding.peak).toBe(EMBEDDING_CONCURRENCY);
    expect(EMBEDDING_CONCURRENCY).toBe(3);
  });
});

describe('search pipeline performance (quality extraction)', () => {
  it('caps extractor calls in flight and the page text that is chunked', async () => {
    /* ~400k characters per page: a long article or a huge listing. */
    const sentence = 'Rust ownership keeps memory safe without a collector. ';
    const page = sentence.repeat(Math.ceil(400_000 / sentence.length));
    scrapeMock.mockImplementation(async (url: string) => ({
      title: url,
      content: page,
    }));

    let inFlight = 0;
    let peak = 0;
    const llm = new FakeLLM({
      generateObject: async (_input, i) => {
        if (i === 0) return { picked_indices: [0, 1, 2] };
        inFlight += 1;
        peak = Math.max(peak, inFlight);
        await new Promise((r) => setTimeout(r, 5));
        inFlight -= 1;
        return { extracted_facts: '- fact' };
      },
    });

    const started = performance.now();
    const results = await executeSearch({
      queries: ['rust web'],
      mode: 'quality',
      researchBlock: newBlock() as any,
      session: createFakeSession() as any,
      llm,
      embedding: new FakeEmbedding(),
    });
    const extractorCalls = llm.calls.length - 1;

    console.log(
      `[perf] quality: ${extractorCalls} extractor calls for 3 pages, peak in flight ${peak}, ${(performance.now() - started).toFixed(0)} ms`,
    );
    expect(results).toHaveLength(3);
    expect(peak).toBe(EXTRACTOR_CONCURRENCY);
    expect(EXTRACTOR_CONCURRENCY).toBe(3);
    /* Every chunk sent comes from the first MAX_PAGE_CHARS characters. */
    const sent = llm.calls
      .slice(1)
      .map((c) => c.input.messages[1].content as string)
      .map((u) => u.match(/<scraped_data>([\s\S]*)<\/scraped_data>/)![1]);
    const perPage = sent.length / 3;
    expect(perPage * 3).toBe(sent.length);
    expect(MAX_PAGE_CHARS).toBe(100_000);
    expect(perPage).toBeLessThanOrEqual(10);
  });
});
