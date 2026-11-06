import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  FakeEmbedding,
  FakeLLM,
  createFakeSession,
} from '@/__tests__/helpers/fakes';

const searxResults: Record<
  string,
  { title: string; url: string; content?: string }[]
> = {
  'rust web': [
    {
      title: 'Rust web',
      url: 'https://a.test/rust',
      content: 'rust web memory',
    },
    {
      title: 'Rust web dup',
      url: 'https://b.test/rust',
      content: 'rust web memory',
    },
    { title: 'Unrelated', url: 'https://c.test/x', content: 'cooking recipes' },
    { title: 'tokio async', url: 'https://d.test/tokio', content: '' },
  ],
  'go concurrency': [
    {
      title: 'Go',
      url: 'https://e.test/go',
      content: 'go goroutines concurrency',
    },
    {
      title: 'Rust web again',
      url: 'https://a.test/rust',
      content: 'rust web memory',
    },
  ],
  /* The same page (P) reached through two URL variants by two queries,
     with contents far enough apart that the embedding dedup keeps both. */
  'rust tokio': [
    { title: 'P', url: 'https://p.test/page', content: 'rust tokio' },
    { title: 'Q', url: 'https://q.test/', content: 'rust tokio memory async' },
  ],
  'rust async': [
    {
      title: 'P again',
      url: 'https://P.test/page/?utm_source=feed&fbclid=1#top',
      content: 'rust async',
    },
    { title: 'R', url: 'https://r.test/', content: 'rust async go web' },
  ],
  /* Twelve results that are all below the 0.5 similarity threshold. */
  'low scores': Array.from({ length: 12 }, (_, i) => ({
    title: `Low ${i}`,
    url: `https://low.test/${i}`,
    content: `low ${i}`,
  })),
};

vi.mock('@/lib/searxng', () => ({
  searchSearxng: vi.fn(async (q: string) => ({
    results: searxResults[q] ?? [],
    suggestions: [],
  })),
}));

const scrapeMock = vi.fn();
vi.mock('@/lib/scraper', () => ({
  default: { scrape: (url: string) => scrapeMock(url) },
}));

import { executeSearch } from '../researcher/actions/search/baseSearch';
import { searchSearxng } from '@/lib/searxng';

const newResearchBlock = () => ({
  id: 'research',
  type: 'research' as const,
  data: { subSteps: [] as any[] },
});

describe('executeSearch (speed and balanced)', () => {
  beforeEach(() => vi.mocked(searchSearxng).mockClear());

  it.each(['speed', 'balanced'] as const)(
    '%s: embeds query and each result, filters, dedups and keeps the top 20',
    async (mode) => {
      const embedding = new FakeEmbedding();
      const session = createFakeSession();
      const block = newResearchBlock();

      const results = await executeSearch({
        queries: ['rust web', 'go concurrency'],
        mode,
        researchBlock: block as any,
        session: session as any,
        llm: new FakeLLM({}),
        embedding,
      });

      // One embedding call per query, holding the query and its results.
      expect(embedding.calls).toHaveLength(2);
      expect(embedding.calls.map((c) => c[0]).sort()).toEqual([
        'go concurrency',
        'rust web',
      ]);
      expect(embedding.calls.map((c) => c.length).sort()).toEqual([
        1 + 2,
        1 + 4,
      ]);
      expect(vi.mocked(searchSearxng)).toHaveBeenCalledTimes(2);

      // Similarity metadata is stripped before returning.
      results.forEach((r) => {
        expect(r.metadata.embedding).toBeUndefined();
        expect(r.metadata.similarity).toBeUndefined();
      });
      expect(results.map((r) => r.metadata.url)).toMatchSnapshot();

      // UI steps: "searching" then one "search_results" step.
      expect(block.data.subSteps.map((s) => s.type)).toEqual([
        'searching',
        'search_results',
      ]);
      expect(block.data.subSteps[0].searching).toEqual([
        'rust web',
        'go concurrency',
      ]);
    },
  );

  it('falls back to unranked snippets when the embedding model fails', async () => {
    const embedding = new FakeEmbedding();
    embedding.embedText = async () => {
      throw new Error('embedding down');
    };

    const results = await executeSearch({
      queries: ['rust web'],
      mode: 'speed',
      researchBlock: newResearchBlock() as any,
      session: createFakeSession() as any,
      llm: new FakeLLM({}),
      embedding,
    });

    expect(results.map((r) => r.content)).toEqual([
      'rust web memory',
      'rust web memory',
      'cooking recipes',
      'tokio async',
    ]);
  });
});

/* Query "low scores" -> e0; result "low i" -> similarity 0.04 * (i + 1)
   to the query (all under 0.5) and at most 0.25 between results, so the
   embedding dedup keeps them all. */
class LowScoreEmbedding extends FakeEmbedding {
  async embedText(texts: string[]): Promise<number[][]> {
    this.calls.push(texts);
    return texts.map((t) => {
      const v = new Array(14).fill(0);
      const m = t.match(/^low (\d+)$/);
      if (!m) {
        v[0] = 1;
        return v;
      }
      const i = Number(m[1]);
      const s = 0.04 * (i + 1);
      v[0] = s;
      v[i + 1] = Math.sqrt(1 - s * s);
      return v;
    });
  }
}

describe('executeSearch (similarity fallback)', () => {
  it.each(['speed', 'balanced'] as const)(
    '%s: keeps the top 10 by score when the filter would drop every result',
    async (mode) => {
      const results = await executeSearch({
        queries: ['low scores'],
        mode,
        researchBlock: newResearchBlock() as any,
        session: createFakeSession() as any,
        llm: new FakeLLM({}),
        embedding: new LowScoreEmbedding(),
      });

      expect(results.map((r) => r.metadata.url)).toEqual(
        [11, 10, 9, 8, 7, 6, 5, 4, 3, 2].map((i) => `https://low.test/${i}`),
      );
    },
  );

  it('does not fall back when some result passes the filter', async () => {
    const results = await executeSearch({
      queries: ['rust web'],
      mode: 'speed',
      researchBlock: newResearchBlock() as any,
      session: createFakeSession() as any,
      llm: new FakeLLM({}),
      embedding: new FakeEmbedding(),
    });

    expect(results.map((r) => r.metadata.url)).not.toContain(
      'https://c.test/x',
    );
  });
});

describe('executeSearch (URL dedup)', () => {
  const normalized = (u: string) =>
    u
      .toLowerCase()
      .replace(/[?#].*$/, '')
      .replace(/\/$/, '');

  it.each(['speed', 'balanced'] as const)(
    '%s: keeps one result per normalized URL across queries',
    async (mode) => {
      const results = await executeSearch({
        queries: ['rust tokio', 'rust async'],
        mode,
        researchBlock: newResearchBlock() as any,
        session: createFakeSession() as any,
        llm: new FakeLLM({}),
        embedding: new FakeEmbedding(),
      });

      const urls = results.map((r) => normalized(r.metadata.url));
      expect(urls).toHaveLength(3);
      expect(new Set(urls).size).toBe(3);
    },
  );

  it('quality: the picker sees each page once', async () => {
    scrapeMock.mockResolvedValue({ title: 't', content: 'c' });
    const llm = new FakeLLM({
      generateObject: (_i, n) =>
        n === 0 ? { picked_indices: [0] } : { extracted_facts: 'x' },
    });

    await executeSearch({
      queries: ['rust tokio', 'rust async'],
      mode: 'quality',
      researchBlock: newResearchBlock() as any,
      session: createFakeSession() as any,
      llm,
      embedding: new FakeEmbedding(),
    });

    const pickerUser = llm.calls[0].input.messages[1].content as string;
    expect(pickerUser.match(/<result indice=/g)).toHaveLength(3);
  });
});

describe('executeSearch (quality)', () => {
  beforeEach(() => scrapeMock.mockReset());

  it('picks results with the LLM, scrapes them and extracts facts per chunk', async () => {
    scrapeMock.mockImplementation(async (url: string) => ({
      title: `T ${url}`,
      content: `# T - ${url}\nBody of ${url}.`,
    }));

    const llm = new FakeLLM({
      generateObject: (input, i) => {
        if (i === 0) return { picked_indices: [0, 4, 99, 3, 2] };
        const user = input.messages[1].content as string;
        return {
          extracted_facts: `- fact from ${user.match(/Body of (\S+)\./)?.[1]}`,
        };
      },
    });

    const block = newResearchBlock();
    const results = await executeSearch({
      queries: ['rust web', 'go concurrency'],
      mode: 'quality',
      researchBlock: block as any,
      session: createFakeSession() as any,
      llm,
      embedding: new FakeEmbedding(),
    });

    // Picker sees every page once (a.test/rust came from both queries);
    // only the first 3 indices are used and
    // out-of-range indices are dropped.
    const pickerUser = llm.calls[0].input.messages[1].content as string;
    expect(pickerUser).toContain('<queries>rust web, go concurrency</queries>');
    expect(pickerUser.match(/<result indice=/g)).toHaveLength(5);

    const scraped = scrapeMock.mock.calls.map((c) => c[0]).sort();
    expect(scraped).toEqual(['https://a.test/rust', 'https://e.test/go']);

    expect(results.map((r) => r.content).sort()).toEqual([
      '- fact from https://a.test/rust\n',
      '- fact from https://e.test/go\n',
    ]);
    expect(block.data.subSteps.map((s) => s.type)).toEqual([
      'searching',
      'search_results',
      'reading',
    ]);
  });

  it('does not read again a URL already read in this research block', async () => {
    scrapeMock.mockResolvedValue({ title: 't', content: 'c' });
    const block = newResearchBlock();
    block.data.subSteps.push({
      id: 'r0',
      type: 'reading',
      reading: [{ content: '', metadata: { url: 'https://a.test/rust' } }],
    });

    await executeSearch({
      queries: ['rust web'],
      mode: 'quality',
      researchBlock: block as any,
      session: createFakeSession() as any,
      llm: new FakeLLM({
        generateObject: (_i, n) =>
          n === 0 ? { picked_indices: [0] } : { extracted_facts: 'x' },
      }),
      embedding: new FakeEmbedding(),
    });

    expect(scrapeMock).not.toHaveBeenCalled();
  });
});
