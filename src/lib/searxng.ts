import { getSearxngURL } from './config/serverRegistry';
import { SearchHttpError, parseRetryAfter } from './searchErrors';

export interface SearxngSearchOptions {
  categories?: string[];
  engines?: string[];
  language?: string;
  pageno?: number;
  /** Only keep results newer than this. Engines without date support ignore it. */
  time_range?: 'day' | 'week' | 'month' | 'year';
}

export interface SearxngSearchResult {
  title: string;
  url: string;
  img_src?: string;
  thumbnail_src?: string;
  thumbnail?: string;
  content?: string;
  author?: string;
  iframe_src?: string;
  /** Publication date when the engine knows it (mostly news results). */
  publishedDate?: string | null;
}

export const searchSearxng = async (
  query: string,
  opts?: SearxngSearchOptions,
) => {
  const searxngURL = getSearxngURL();

  const url = new URL(`${searxngURL}/search?format=json`);
  url.searchParams.append('q', query);

  if (opts) {
    Object.keys(opts).forEach((key) => {
      const value = opts[key as keyof SearxngSearchOptions];
      if (Array.isArray(value)) {
        url.searchParams.append(key, value.join(','));
        return;
      }
      url.searchParams.append(key, value as string);
    });
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);

  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        // SearXNG's default botdetection rejects requests that do not identify
        // an origin IP. Server-side searches from Vane do not have a browser
        // proxy adding these headers, so provide a loopback address explicitly.
        'X-Forwarded-For': '127.0.0.1',
        'X-Real-IP': '127.0.0.1',
      },
    });

    if (!res.ok) {
      throw new SearchHttpError(
        `SearXNG error: ${res.statusText}`,
        res.status,
        parseRetryAfter(res.headers?.get?.('retry-after')),
      );
    }

    const data = await res.json();

    const results: SearxngSearchResult[] = data.results;
    const suggestions: string[] = data.suggestions;

    return { results, suggestions };
  } catch (err: any) {
    if (err.name === 'AbortError') {
      throw new Error('SearXNG search timed out');
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }
};
