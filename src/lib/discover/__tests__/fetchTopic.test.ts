import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const searxngURL = vi.hoisted(() => ({ value: '' }));

vi.mock('@/lib/config/serverRegistry', () => ({
  getSearxngURL: () => searxngURL.value,
}));

import {
  clearDiscoverCache,
  getKeywordItems,
  getTopicItems,
  googleNewsFeedUrl,
  mergeItems,
} from '../fetchTopic';
import type { DiscoverTopic } from '../types';

const feedXml = (n: number, host = 'news.test') =>
  `<rss><channel>${Array.from(
    { length: n },
    (_, i) =>
      `<item><title>Item ${host} ${i}</title><link>https://${host}/${i}</link><pubDate>Thu, 0${(i % 5) + 1} Nov 2026 10:00:00 GMT</pubDate></item>`,
  ).join('')}</channel></rss>`;

const topic: DiscoverTopic = {
  id: 'tech',
  feeds: ['https://a.test/feed', 'https://b.test/feed'],
  fallback: { sites: ['a.test'], queries: ['tecnologia'] },
};

describe('mergeItems', () => {
  it('dedupes by URL and title and sorts newest first', () => {
    const merged = mergeItems([
      [
        {
          title: 'Old',
          url: 'https://x.test/1',
          content: '',
          publishedAt: '2026-01-01T00:00:00Z',
        },
        { title: 'No date', url: 'https://x.test/2', content: '' },
      ],
      [
        { title: 'Dup url', url: 'https://X.test/1/?utm=1', content: '' },
        { title: 'old ', url: 'https://y.test/9', content: '' },
        {
          title: 'New',
          url: 'https://x.test/3',
          content: '',
          publishedAt: '2026-11-01T00:00:00Z',
        },
      ],
    ]);
    expect(merged.map((i) => i.title)).toEqual(['New', 'Old', 'No date']);
  });
});

describe('getTopicItems', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    clearDiscoverCache();
    fetchMock.mockReset();
    searxngURL.value = '';
    vi.stubGlobal('fetch', fetchMock);
  });
  afterEach(() => vi.unstubAllGlobals());

  it('keeps the feeds that work when another one fails', async () => {
    fetchMock.mockImplementation(async (url: string) =>
      url.startsWith('https://a.test')
        ? new Response(feedXml(10, 'a.test'))
        : new Response('down', { status: 503 }),
    );
    const items = await getTopicItems(topic, 'pt-BR');
    expect(items).toHaveLength(10);
    expect(items.every((i) => i.source === 'a.test')).toBe(true);
  });

  it('caches a topic between calls', async () => {
    fetchMock.mockImplementation(async () => new Response(feedXml(10)));
    await getTopicItems(topic, 'pt-BR');
    await getTopicItems(topic, 'pt-BR');
    expect(fetchMock).toHaveBeenCalledTimes(2); // two feeds, once
  });

  it('asks SearXNG for recent Portuguese news when the feeds bring too little', async () => {
    searxngURL.value = 'http://searxng.test';
    fetchMock.mockImplementation(async (url: string | URL) => {
      const u = String(url);
      if (u.startsWith('http://searxng.test')) {
        return new Response(
          JSON.stringify({
            results: [
              { title: 'Busca', url: 'https://a.test/busca', content: 'x' },
            ],
          }),
        );
      }
      return new Response(feedXml(2, 'a.test'));
    });

    const items = await getTopicItems(topic, 'pt-BR');
    const searchUrl = fetchMock.mock.calls
      .map(([u]) => String(u))
      .find((u) => u.startsWith('http://searxng.test'))!;
    const params = new URL(searchUrl).searchParams;
    expect(params.get('q')).toBe('site:a.test tecnologia');
    expect(params.get('language')).toBe('pt-BR');
    expect(params.get('time_range')).toBe('week');
    expect(items.map((i) => i.title)).toContain('Busca');
  });

  it('fails when no source returns anything', async () => {
    fetchMock.mockResolvedValue(new Response('down', { status: 500 }));
    await expect(getTopicItems(topic, 'pt-BR')).rejects.toThrow(/No articles/);
  });
});

describe('getKeywordItems', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    clearDiscoverCache();
    fetchMock.mockReset();
    searxngURL.value = '';
    vi.stubGlobal('fetch', fetchMock);
  });
  afterEach(() => vi.unstubAllGlobals());

  it('uses the Google News feed when SearXNG is not configured', async () => {
    fetchMock.mockResolvedValue(new Response(feedXml(3, 'news.google.com')));
    const items = await getKeywordItems('Pix', 'pt-BR');
    expect(items).toHaveLength(3);
    expect(String(fetchMock.mock.calls[0][0])).toBe(
      googleNewsFeedUrl('Pix', 'pt-BR'),
    );
  });

  it('builds a Google News URL for the language', () => {
    const url = new URL(googleNewsFeedUrl('Copa do Mundo', 'pt-BR'));
    expect(url.searchParams.get('q')).toBe('Copa do Mundo when:7d');
    expect(url.searchParams.get('hl')).toBe('pt-BR');
    expect(url.searchParams.get('ceid')).toBe('BR:pt-419');
  });
});
