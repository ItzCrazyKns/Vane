import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const firecrawlURL = vi.hoisted(() => ({ value: 'http://firecrawl.test/' }));

vi.mock('@/lib/config/serverRegistry', () => ({
  getFirecrawlURL: () => firecrawlURL.value,
}));

import {
  buildFirecrawlSearchBody,
  searchFirecrawl,
  FIRECRAWL_SEARCH_LIMIT,
} from '../firecrawlSearch';

describe('buildFirecrawlSearchBody', () => {
  it('asks only for web snippets', () => {
    expect(buildFirecrawlSearchBody('rust vs go')).toEqual({
      query: 'rust vs go',
      limit: FIRECRAWL_SEARCH_LIMIT,
      sources: ['web'],
      timeout: 15000,
    });
  });

  it('maps reddit to a site filter and academic engines to research', () => {
    expect(
      buildFirecrawlSearchBody('best keyboard', { engines: ['reddit'] }).query,
    ).toBe('best keyboard site:reddit.com');

    const body = buildFirecrawlSearchBody('transformers', {
      engines: ['arxiv', 'google scholar', 'pubmed'],
      language: 'pt',
    });
    expect(body.categories).toEqual(['research']);
    expect(body.lang).toBe('pt');
    expect(body.query).toBe('transformers');
  });
});

describe('buildFirecrawlSearchBody filters', () => {
  it('maps time_range to tbs and keeps the language', () => {
    expect(
      buildFirecrawlSearchBody('eleição', {
        time_range: 'week',
        language: 'pt',
      }),
    ).toMatchObject({ query: 'eleição', tbs: 'qdr:w', lang: 'pt' });
    expect(buildFirecrawlSearchBody('x')).not.toHaveProperty('tbs');
  });
});

describe('searchFirecrawl', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    firecrawlURL.value = 'http://firecrawl.test/';
    vi.stubGlobal('fetch', fetchMock);
    delete process.env.FIRECRAWL_API_KEY;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.FIRECRAWL_API_KEY;
  });

  it('posts to /v2/search and maps results to the SearXNG shape', async () => {
    process.env.FIRECRAWL_API_KEY = 'fc-key';
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          success: true,
          data: {
            web: [
              {
                url: 'https://example.org/a',
                title: ' A ',
                description: 'snippet A',
              },
              { url: 'https://example.org/b' },
              { title: 'no url' },
            ],
          },
        }),
        { status: 200 },
      ),
    );

    const res = await searchFirecrawl('q');

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('http://firecrawl.test/v2/search');
    expect(init.method).toBe('POST');
    expect(init.headers.Authorization).toBe('Bearer fc-key');
    expect(JSON.parse(init.body).query).toBe('q');
    expect(res).toEqual({
      results: [
        { url: 'https://example.org/a', title: 'A', content: 'snippet A' },
        {
          url: 'https://example.org/b',
          title: 'https://example.org/b',
          content: undefined,
        },
      ],
      suggestions: [],
    });
  });

  it('omits the auth header without a key and accepts a v1-style array', async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          success: true,
          data: [{ url: 'https://x.dev', title: 'X', description: 'd' }],
        }),
        { status: 200 },
      ),
    );

    const res = await searchFirecrawl('q');
    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBeUndefined();
    expect(res.results).toHaveLength(1);
  });

  it('throws on HTTP or API errors', async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ success: false, error: 'boom' }), {
        status: 500,
      }),
    );
    await expect(searchFirecrawl('q')).rejects.toThrow(
      'Firecrawl search error: 500 boom',
    );
  });

  it('turns a timeout into a readable error', async () => {
    fetchMock.mockRejectedValue(
      Object.assign(new Error('t'), { name: 'TimeoutError' }),
    );
    await expect(searchFirecrawl('q')).rejects.toThrow(
      'Firecrawl search timed out',
    );
  });

  it('fails clearly when no Firecrawl URL is configured', async () => {
    firecrawlURL.value = '';
    await expect(searchFirecrawl('q')).rejects.toThrow(
      'no Firecrawl URL is configured',
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
