/* Suggestions 3, 4 and 20 of the Perplexity comparison: hybrid ranking
   (engine order + embeddings + keywords, fused with RRF), passage
   retrieval from the top pages in balanced, and a second search when the
   evidence is weak. */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  FakeEmbedding,
  FakeLLM,
  createFakeSession,
} from '@/__tests__/helpers/fakes';

const searxngMock = vi.fn();
vi.mock('@/lib/searxng', () => ({
  searchSearxng: (q: string, o: any) => searxngMock(q, o),
}));

const scrapeMock = vi.fn();
vi.mock('@/lib/scraper', () => ({
  default: { scrape: (url: string) => scrapeMock(url) },
}));

import {
  fuseQueryResults,
  lexicalScore,
  ranksOf,
  rrf,
  tokenize,
} from '../researcher/actions/search/ranking';
import {
  bestPassages,
  executeSearch,
} from '../researcher/actions/search/baseSearch';
import { parseSearchFilters } from '../researcher/actions/search/filters';
import Researcher, { NO_EVIDENCE_NOTE } from '../researcher';

const newBlock = () => ({
  id: 'research',
  type: 'research' as const,
  data: { subSteps: [] as any[] },
});

const search = (
  queries: string[],
  extra: Partial<Parameters<typeof executeSearch>[0]> = {},
) =>
  executeSearch({
    queries,
    mode: 'balanced',
    researchBlock: newBlock() as any,
    session: createFakeSession() as any,
    llm: new FakeLLM({}),
    embedding: new FakeEmbedding(),
    ...extra,
  });

describe('ranking helpers', () => {
  it('tokenizes without accents, case or stopwords', () => {
    expect(tokenize('Qual é a Vacina da Dengue?')).toEqual([
      'vacina',
      'dengue',
    ]);
  });

  it('scores title hits above body hits', () => {
    expect(lexicalScore('rust tokio', 'Rust tokio guide', '')).toBe(1);
    expect(lexicalScore('rust tokio', '', 'rust and tokio')).toBe(0.5);
    expect(lexicalScore('rust tokio', '', 'cooking')).toBe(0);
    expect(lexicalScore('a o', 'x', 'y')).toBe(0);
  });

  it('gives tied scores the same rank', () => {
    expect(ranksOf([0.2, 0.9, 0.2, 0.5])).toEqual([3, 1, 3, 2]);
    expect(ranksOf([1, 1, 1])).toEqual([1, 1, 1]);
  });

  it('fuses engine, vector and keyword ranks', () => {
    /* The third result is last for the engine but best by embedding and
       keywords, so it overtakes the first. */
    const fused = fuseQueryResults(
      'rust tokio',
      undefined,
      [
        { title: 'Cooking', content: 'recipes' },
        { title: 'Go', content: 'goroutines' },
        { title: 'Rust tokio', content: 'rust tokio async' },
      ],
      [0.1, 0.2, 0.9],
    );
    expect(fused[2]).toBeGreaterThan(fused[0]);
    expect(fused[2]).toBeCloseTo(rrf([3, 1, 1]));
  });
});

describe('executeSearch hybrid ranking', () => {
  beforeEach(() => {
    searxngMock.mockReset();
    scrapeMock.mockReset();
  });

  it('ranks a page found by several queries first', async () => {
    searxngMock.mockImplementation(async (q: string) => ({
      results:
        q === 'rust web'
          ? [
              { title: 'A', url: 'https://a.test/', content: 'rust web' },
              {
                title: 'Shared',
                url: 'https://shared.test/',
                content: 'rust web async',
              },
            ]
          : [
              { title: 'B', url: 'https://b.test/', content: 'rust async' },
              {
                title: 'Shared',
                url: 'https://shared.test/',
                content: 'rust web async',
              },
            ],
      suggestions: [],
    }));

    const results = await search(['rust web', 'rust async']);
    expect(results[0].metadata.url).toBe('https://shared.test/');
    results.forEach((r) => expect(r.metadata).not.toHaveProperty('score'));
  });
});

describe('weak evidence retry', () => {
  beforeEach(() => searxngMock.mockReset());

  it('searches again without filters when a filtered search finds too little', async () => {
    searxngMock.mockImplementation(async (q: string) => ({
      results: String(q).includes('site:')
        ? []
        : [
            { title: 'Rust', url: 'https://a.test/', content: 'rust web' },
            { title: 'Rust 2', url: 'https://b.test/', content: 'rust async' },
          ],
      suggestions: [],
    }));

    const results = await search(['rust web'], {
      filters: parseSearchFilters({ domains: ['gov.br'], recency: 'week' }),
    });

    expect(searxngMock).toHaveBeenCalledTimes(2);
    expect(searxngMock.mock.calls[0]).toEqual([
      'rust web site:gov.br',
      { time_range: 'week' },
    ]);
    expect(searxngMock.mock.calls[1]).toEqual(['rust web', {}]);
    expect(results.map((r) => r.metadata.url)).toContain('https://a.test/');
  });

  it('does not retry an unfiltered search or one with enough results', async () => {
    searxngMock.mockResolvedValue({ results: [], suggestions: [] });
    await search(['rust web']);
    expect(searxngMock).toHaveBeenCalledTimes(1);

    searxngMock.mockReset();
    searxngMock.mockResolvedValue({
      /* Three results distinct enough to survive the relevance filter
         and the near-duplicate dedup. */
      results: [
        ['a', 'rust web'],
        ['b', 'go concurrency web'],
        ['c', 'tokio async web'],
      ].map(([h, content]) => ({
        title: h,
        url: `https://${h}.gov.br/`,
        content,
      })),
      suggestions: [],
    });
    const results = await search(['web rust go tokio concurrency async'], {
      filters: parseSearchFilters({ domains: ['gov.br'] }),
    });
    expect(results).toHaveLength(3);
    expect(searxngMock).toHaveBeenCalledTimes(1);
  });
});

describe('passage retrieval (balanced)', () => {
  beforeEach(() => {
    searxngMock.mockReset();
    scrapeMock.mockReset();
  });

  const page = [
    'Cooking pasta takes about ten minutes in boiling salted water today.',
    'Rust tokio is an async runtime used for web servers with high memory safety.',
    'The weather tomorrow will be sunny with a light breeze in the afternoon.',
    'Go goroutines handle concurrency with channels and a small memory footprint.',
  ].join('\n');

  it('picks the passages that match the question, in page order', async () => {
    const passages = await bestPassages(
      page,
      'rust tokio async web',
      new FakeEmbedding(),
      1,
    );
    expect(passages).toHaveLength(1);
    expect(passages[0]).toContain('Rust tokio');
  });

  it('appends the best passages of the top pages to their snippets', async () => {
    searxngMock.mockResolvedValue({
      results: [
        { title: 'Rust', url: 'https://a.test/', content: 'rust tokio web' },
        { title: 'Go', url: 'https://b.test/', content: 'tokio web async' },
        { title: 'More', url: 'https://c.test/', content: 'rust web memory' },
      ],
      suggestions: [],
    });
    scrapeMock.mockImplementation(async (url: string) =>
      url === 'https://b.test/'
        ? { title: 'Failed to scrape', content: '# error' }
        : { title: 't', content: page },
    );

    const block = newBlock();
    const results = await search(['rust tokio web'], {
      readPages: 2,
      researchBlock: block as any,
      question: 'rust tokio async web',
    });

    expect(scrapeMock).toHaveBeenCalledTimes(2);
    const read = results.filter((r) => r.content.includes('Rust tokio is'));
    expect(read).toHaveLength(1);
    // The page that failed keeps its snippet only.
    const failed = results.find((r) => r.metadata.url === 'https://b.test/');
    if (failed) expect(failed.content).toBe('tokio web async');
    expect(block.data.subSteps.map((s) => s.type)).toContain('reading');
  });

  it('reads nothing by default', async () => {
    searxngMock.mockResolvedValue({
      results: [{ title: 'Rust', url: 'https://a.test/', content: 'rust' }],
      suggestions: [],
    });
    await search(['rust']);
    expect(scrapeMock).not.toHaveBeenCalled();
  });
});

describe('Researcher with no evidence', () => {
  beforeEach(() => {
    searxngMock.mockReset();
    scrapeMock.mockReset();
    scrapeMock.mockResolvedValue({ title: 't', content: '' });
  });

  const call = (id: string, name: string, args: any) => ({
    contentChunk: '',
    toolCallChunk: [{ id, name, arguments: args }],
  });

  const research = (llm: FakeLLM, sources: string[] = ['web']) =>
    new Researcher().research(createFakeSession() as any, {
      chatHistory: [],
      followUp: 'rust?',
      classification: {
        classification: {
          skipSearch: false,
          personalSearch: false,
          academicSearch: false,
          discussionSearch: false,
          showWeatherWidget: false,
          showStockWidget: false,
          showCalculationWidget: false,
        },
        standaloneFollowUp: 'Is Rust good for web?',
      },
      config: {
        sources: sources as any,
        fileIds: [],
        llm,
        embedding: new FakeEmbedding(),
        mode: 'balanced',
        systemInstructions: '',
      },
    });

  it('asks for one more search when done comes with no sources', async () => {
    searxngMock.mockImplementation(async (q: string) => ({
      results:
        q === 'rust web broad'
          ? [{ title: 'Rust', url: 'https://a.test/', content: 'rust web' }]
          : [],
      suggestions: [],
    }));
    const llm = new FakeLLM({
      streamText: (_input, i) =>
        i === 0
          ? [
              call('c1', 'web_search', { queries: ['rust web narrow'] }),
              call('c2', 'done', {}),
            ]
          : i === 1
            ? [call('c3', 'web_search', { queries: ['rust web broad'] })]
            : [call('c4', 'done', {})],
    });

    const out = await research(llm);

    const streams = llm.calls.filter((c) => c.kind === 'streamText');
    expect(streams).toHaveLength(3);
    const toolMessages = streams[1].input.messages.filter(
      (m: any) => m.role === 'tool',
    );
    expect(toolMessages.map((m: any) => m.id)).toEqual(['c1', 'c2']);
    expect(toolMessages[1].content).toContain(NO_EVIDENCE_NOTE);
    expect(out.searchFindings.map((c) => c.metadata.url)).toEqual([
      'https://a.test/',
    ]);
  });

  it('asks only once', async () => {
    searxngMock.mockResolvedValue({ results: [], suggestions: [] });
    const llm = new FakeLLM({ streamText: () => [call('c1', 'done', {})] });

    await research(llm);

    expect(llm.calls.filter((c) => c.kind === 'streamText')).toHaveLength(2);
  });

  it('does not ask when web search is not available', async () => {
    const llm = new FakeLLM({ streamText: () => [call('c1', 'done', {})] });

    await research(llm, []);

    expect(llm.calls.filter((c) => c.kind === 'streamText')).toHaveLength(1);
  });
});
