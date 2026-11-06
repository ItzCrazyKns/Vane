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

    // Picker sees every result; only the first 3 indices are used and
    // out-of-range indices are dropped.
    const pickerUser = llm.calls[0].input.messages[1].content as string;
    expect(pickerUser).toContain('<queries>rust web, go concurrency</queries>');
    expect(pickerUser.match(/<result indice=/g)).toHaveLength(6);

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
