/* Suggestions 1, 2 and 21 of the Perplexity comparison: optional
   recency / domain / language filters on web_search, the publication date
   carried to the writer, and the result budget split across queries. */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  FakeEmbedding,
  FakeLLM,
  createFakeSession,
} from '@/__tests__/helpers/fakes';
import {
  applyDomainOperators,
  filterResultsByDomain,
  normalizeDomain,
  parseSearchFilters,
  toSearchOptions,
} from '../researcher/actions/search/filters';

const searxngMock = vi.fn();
vi.mock('@/lib/searxng', () => ({
  searchSearxng: (q: string, opts: unknown) => searxngMock(q, opts),
}));
vi.mock('@/lib/scraper', () => ({ default: { scrape: vi.fn() } }));

import {
  RESULTS_PER_SEARCH_CALL,
  executeSearch,
  toIsoDate,
} from '../researcher/actions/search/baseSearch';
import webSearchAction from '../researcher/actions/search/webSearch';
import { formatSearchResult } from '../writerContext';

const block = () => ({
  id: 'research',
  type: 'research' as const,
  data: { subSteps: [] as any[] },
});

const run = (
  queries: string[],
  extra: Record<string, unknown> = {},
  mode: 'speed' | 'balanced' | 'quality' = 'balanced',
) =>
  executeSearch({
    queries,
    mode,
    researchBlock: block() as any,
    session: createFakeSession() as any,
    llm: new FakeLLM({}),
    embedding: new FakeEmbedding(),
    ...extra,
  });

describe('parseSearchFilters', () => {
  it('keeps valid values and splits allowed and excluded domains', () => {
    expect(
      parseSearchFilters({
        recency: 'week',
        domains: ['https://www.Gov.br/x', '-pinterest.com', 'site:arxiv.org'],
        language: 'PT',
      }),
    ).toEqual({
      recency: 'week',
      includeDomains: ['gov.br', 'arxiv.org'],
      excludeDomains: ['pinterest.com'],
      language: 'pt',
    });
  });

  it('drops invalid values instead of failing', () => {
    expect(
      parseSearchFilters({
        recency: 'decade',
        domains: [42, 'not a domain', ''],
        language: 'portuguese',
      }),
    ).toEqual({ includeDomains: [], excludeDomains: [] });
    expect(parseSearchFilters({ domains: 'a.com, -b.org' })).toMatchObject({
      includeDomains: ['a.com'],
      excludeDomains: ['b.org'],
    });
  });

  it('caps the number of domains', () => {
    const domains = Array.from({ length: 30 }, (_, i) => `d${i}.com`);
    expect(parseSearchFilters({ domains }).includeDomains).toHaveLength(10);
  });

  it('normalizes domains', () => {
    expect(normalizeDomain('HTTP://WWW.Example.COM:8080/a?b')).toBe(
      'example.com',
    );
    expect(normalizeDomain('localhost')).toBeUndefined();
  });
});

describe('filter helpers', () => {
  const f = parseSearchFilters({
    domains: ['gov.br', 'who.int', '-fake.gov.br'],
  });

  it('adds site: operators to the query', () => {
    expect(applyDomainOperators('vacina', f)).toBe(
      'vacina (site:gov.br OR site:who.int) -site:fake.gov.br',
    );
    expect(
      applyDomainOperators('x', parseSearchFilters({ domains: ['a.com'] })),
    ).toBe('x site:a.com');
  });

  it('enforces the domains on the results, subdomains included', () => {
    const results = [
      { url: 'https://www.saude.gov.br/a' },
      { url: 'https://fake.gov.br/b' },
      { url: 'https://example.com/c' },
      { url: 'https://who.int/d' },
      { url: 'not a url' },
    ];
    expect(filterResultsByDomain(results, f).map((r) => r.url)).toEqual([
      'https://www.saude.gov.br/a',
      'https://who.int/d',
    ]);
  });

  it('maps recency and language to provider options', () => {
    expect(
      toSearchOptions(parseSearchFilters({ recency: 'day', language: 'en' })),
    ).toEqual({ time_range: 'day', language: 'en' });
  });
});

describe('toIsoDate', () => {
  it('keeps plausible dates as YYYY-MM-DD', () => {
    expect(toIsoDate('2026-11-01T08:00:00Z')).toBe('2026-11-01');
    expect(toIsoDate('2026-03-05')).toBe('2026-03-05');
  });

  it('rejects junk, very old and future dates', () => {
    expect(toIsoDate(null)).toBeUndefined();
    expect(toIsoDate('yesterday')).toBeUndefined();
    expect(toIsoDate('1970-01-01T00:00:00Z')).toBeUndefined();
    expect(toIsoDate('2999-01-01')).toBeUndefined();
  });
});

describe('executeSearch with filters, dates and the result budget', () => {
  beforeEach(() => {
    searxngMock.mockReset();
    searxngMock.mockImplementation(async (q: string) => ({
      results: [
        {
          title: `${q} on gov`,
          url: 'https://www.gov.br/noticia',
          content: q,
          publishedDate: '2026-10-30T12:00:00',
        },
        { title: `${q} elsewhere`, url: 'https://blog.test/x', content: q },
      ],
      suggestions: [],
    }));
  });

  it('sends site: operators and time range, and enforces the domain', async () => {
    const results = await run(['vacina dengue'], {
      filters: parseSearchFilters({ recency: 'week', domains: ['gov.br'] }),
    });

    expect(searxngMock).toHaveBeenCalledWith('vacina dengue site:gov.br', {
      time_range: 'week',
    });
    expect(results.map((r) => r.metadata.url)).toEqual([
      'https://www.gov.br/noticia',
    ]);
  });

  it('runs a plain search without filters', async () => {
    await run(['vacina dengue']);
    expect(searxngMock).toHaveBeenCalledWith('vacina dengue', {});
  });

  it('keeps the publication date on the result', async () => {
    const results = await run(['vacina dengue']);
    const gov = results.find((r) => r.metadata.url.includes('gov.br'))!;
    expect(gov.metadata.publishedDate).toBe('2026-10-30');

    const undated = await run(['vacina dengue'], {
      filters: parseSearchFilters({ domains: ['blog.test'] }),
    });
    expect(undated.map((r) => r.metadata.url)).toEqual(['https://blog.test/x']);
    expect(undated[0].metadata).not.toHaveProperty('publishedDate');
  });

  it('splits the result budget across the queries', async () => {
    searxngMock.mockImplementation(async (q: string) => ({
      results: Array.from({ length: 25 }, (_, i) => ({
        title: `${q} ${i}`,
        url: `https://${q.replace(/\W/g, '')}.test/${i}`,
        content: `${q} ${i}`,
      })),
      suggestions: [],
    }));
    const embedding = new FakeEmbedding();
    await executeSearch({
      queries: ['a', 'b', 'c'],
      mode: 'balanced',
      researchBlock: block() as any,
      session: createFakeSession() as any,
      llm: new FakeLLM({}),
      embedding,
    });
    // Query + its share of the results in each embedding call.
    const perQuery = Math.ceil(RESULTS_PER_SEARCH_CALL / 3);
    expect(embedding.calls.map((c) => c.length)).toEqual([
      1 + perQuery,
      1 + perQuery,
      1 + perQuery,
    ]);
  });
});

describe('web_search action', () => {
  beforeEach(() => {
    searxngMock.mockReset();
    searxngMock.mockResolvedValue({ results: [], suggestions: [] });
  });

  it('passes valid filters through and ignores invalid ones', async () => {
    const session = createFakeSession();
    session.emitBlock({
      id: 'research',
      type: 'research',
      data: { subSteps: [] },
    });
    await webSearchAction.execute(
      {
        type: 'web_search',
        queries: ['eleição'],
        recency: 'month',
        domains: ['-x.com'],
        language: 'zz-invalid',
      } as any,
      {
        session: session as any,
        llm: new FakeLLM({}),
        embedding: new FakeEmbedding(),
        researchBlockId: 'research',
        fileIds: [],
        mode: 'speed',
      } as any,
    );
    expect(searxngMock).toHaveBeenCalledWith('eleição -site:x.com', {
      time_range: 'month',
    });
  });

  it('tells the model about the filters in every mode', () => {
    for (const mode of ['speed', 'balanced', 'quality'] as const) {
      expect(webSearchAction.getDescription({ mode } as any)).toContain(
        '"recency"',
      );
    }
  });
});

describe('formatSearchResult', () => {
  it('gives the writer the site and the date when known', () => {
    expect(
      formatSearchResult(
        {
          content: 'texto',
          metadata: {
            title: 'Título "com aspas"',
            url: 'https://www.gov.br/a',
            publishedDate: '2026-10-30',
          },
        },
        0,
      ),
    ).toBe(
      `<result index=1 title="Título 'com aspas'" source="gov.br" date="2026-10-30">texto</result>`,
    );
  });

  it('leaves out what it does not know', () => {
    expect(
      formatSearchResult(
        { content: 'c', metadata: { title: 'T', url: 'file_id://abc' } },
        1,
      ),
    ).toBe('<result index=2 title="T">c</result>');
  });
});
