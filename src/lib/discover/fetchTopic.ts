import { searchSearxng, SearxngSearchResult } from '@/lib/searxng';
import { getSearxngURL } from '@/lib/config/serverRegistry';
import { createTtlCache } from './cache';
import { fetchFeed } from './rss';
import { cleanThumbnailUrl } from './thumbnail';
import type { DiscoverItem, DiscoverLocale, DiscoverTopic } from './types';

/** How long a topic's articles are reused before the sources are read again. */
export const DISCOVER_CACHE_TTL_MS = 15 * 60 * 1000;
/** Below this many articles from the feeds, the SearXNG fallback also runs. */
export const MIN_FEED_ITEMS = 8;
/** Articles returned per topic. */
export const MAX_ITEMS = 60;

const cache = createTtlCache<DiscoverItem[]>(DISCOVER_CACHE_TTL_MS);

/** Only for tests. */
export const clearDiscoverCache = () => cache.clear();

const searxngLanguage = (locale: DiscoverLocale) =>
  locale === 'pt-BR' ? 'pt-BR' : 'en';

const hostOf = (url: string) => {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return undefined;
  }
};

const fromSearxng = (result: SearxngSearchResult): DiscoverItem | null => {
  if (!result.url || !result.title) return null;
  return {
    title: result.title,
    url: result.url,
    content: result.content ?? '',
    thumbnail: result.thumbnail ?? result.thumbnail_src ?? result.img_src,
    source: hostOf(result.url),
    publishedAt: toIsoDate(
      (result as SearxngSearchResult & { publishedDate?: string })
        .publishedDate,
    ),
  };
};

const toIsoDate = (value?: string) => {
  if (!value) return undefined;
  const time = Date.parse(value);
  return Number.isNaN(time) ? undefined : new Date(time).toISOString();
};

const normalizeUrl = (url: string) =>
  url
    .toLowerCase()
    .trim()
    .replace(/[?#].*$/, '')
    .replace(/\/$/, '');

/**
 * Dedupes by URL (ignoring query and trailing slash) and by title, cleans the
 * image URLs, and orders newest first. Articles without a date go last.
 */
export const mergeItems = (lists: DiscoverItem[][]): DiscoverItem[] => {
  const seenUrls = new Set<string>();
  const seenTitles = new Set<string>();
  const merged: DiscoverItem[] = [];

  for (const item of lists.flat()) {
    const urlKey = normalizeUrl(item.url);
    const titleKey = item.title.toLowerCase().trim();
    if (seenUrls.has(urlKey) || seenTitles.has(titleKey)) continue;
    seenUrls.add(urlKey);
    seenTitles.add(titleKey);
    merged.push({ ...item, thumbnail: cleanThumbnailUrl(item.thumbnail) });
  }

  const time = (item: DiscoverItem) =>
    item.publishedAt ? Date.parse(item.publishedAt) || 0 : 0;

  return merged.sort((a, b) => time(b) - time(a)).slice(0, MAX_ITEMS);
};

const settled = async <T>(tasks: Promise<T>[]) =>
  (await Promise.allSettled(tasks)).flatMap((r) => {
    if (r.status === 'fulfilled') return [r.value];
    console.warn(`[discover] source failed: ${r.reason}`);
    return [];
  });

const searchNews = async (
  query: string,
  locale: DiscoverLocale,
  timeRange: 'week' | 'month',
) => {
  const { results } = await searchSearxng(query, {
    engines: ['bing news'],
    pageno: 1,
    language: searxngLanguage(locale),
    time_range: timeRange,
  });
  return (results ?? [])
    .map(fromSearxng)
    .filter((i): i is DiscoverItem => i !== null);
};

const loadTopic = async (topic: DiscoverTopic, locale: DiscoverLocale) => {
  const feedLists = await settled(topic.feeds.map((url) => fetchFeed(url)));
  let lists = feedLists;

  const feedCount = feedLists.reduce((n, l) => n + l.length, 0);

  if (feedCount < MIN_FEED_ITEMS && topic.fallback && getSearxngURL()) {
    const { sites, queries } = topic.fallback;
    const searches = sites.flatMap((site) =>
      queries.map((q) => searchNews(`site:${site} ${q}`, locale, 'week')),
    );
    lists = [...feedLists, ...(await settled(searches))];
  }

  const items = mergeItems(lists);
  if (items.length === 0) {
    throw new Error(`No articles for topic "${topic.id}"`);
  }
  return items;
};

/** Google News search feed: works without SearXNG and in any language. */
export const googleNewsFeedUrl = (query: string, locale: DiscoverLocale) => {
  const params =
    locale === 'pt-BR'
      ? { hl: 'pt-BR', gl: 'BR', ceid: 'BR:pt-419' }
      : { hl: 'en-US', gl: 'US', ceid: 'US:en' };
  const url = new URL('https://news.google.com/rss/search');
  url.searchParams.set('q', `${query} when:7d`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  return url.toString();
};

const loadKeyword = async (query: string, locale: DiscoverLocale) => {
  const lists = getSearxngURL()
    ? await settled([searchNews(query, locale, 'month')])
    : [];

  // Google News is the fallback for installs without SearXNG or when it finds
  // little. Its links go through a news.google.com redirect and carry no image.
  if (lists.flat().length < MIN_FEED_ITEMS) {
    lists.push(
      ...(await settled([fetchFeed(googleNewsFeedUrl(query, locale))])),
    );
  }

  const items = mergeItems(lists);
  if (items.length === 0) {
    throw new Error(`No articles for "${query}"`);
  }
  return items;
};

export const getTopicItems = (topic: DiscoverTopic, locale: DiscoverLocale) =>
  cache.get(`topic:${locale}:${topic.id}`, () => loadTopic(topic, locale));

export const getKeywordItems = (query: string, locale: DiscoverLocale) =>
  cache.get(`q:${locale}:${query.toLowerCase()}`, () =>
    loadKeyword(query, locale),
  );
