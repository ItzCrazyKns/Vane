import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fixture from '../../../perf-audit/fixtures/characterization/searxng-rust-go.json';

vi.mock('@/lib/config/serverRegistry', () => ({
  getSearxngURL: () => 'http://searxng.test',
}));

import { searchSearxng } from '../searxng';

describe('searchSearxng', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('builds the URL, sends the bot-detection headers and parses results', async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify(fixture), { status: 200 }),
    );

    const res = await searchSearxng('rust vs go', {
      engines: ['arxiv', 'google scholar'],
      language: 'en',
      pageno: 1,
    });

    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toBe(
      'http://searxng.test/search?format=json&q=rust+vs+go&engines=arxiv%2Cgoogle+scholar&language=en&pageno=1',
    );
    expect(init.headers).toEqual({
      'X-Forwarded-For': '127.0.0.1',
      'X-Real-IP': '127.0.0.1',
    });
    expect(init.signal).toBeInstanceOf(AbortSignal);
    expect(res.results).toHaveLength(3);
    expect(res.results[0]).toMatchObject({
      title: 'Rust vs Go for web services',
      url: 'https://example.org/rust-vs-go',
    });
    expect(res.suggestions).toEqual(fixture.suggestions);
  });

  it('throws on HTTP errors', async () => {
    fetchMock.mockResolvedValue(
      new Response('nope', { status: 429, statusText: 'Too Many Requests' }),
    );
    await expect(searchSearxng('q')).rejects.toThrow(
      'SearXNG error: Too Many Requests',
    );
  });

  it('turns an abort into a timeout error', async () => {
    fetchMock.mockRejectedValue(
      Object.assign(new Error('aborted'), { name: 'AbortError' }),
    );
    await expect(searchSearxng('q')).rejects.toThrow(
      'SearXNG search timed out',
    );
  });
});
