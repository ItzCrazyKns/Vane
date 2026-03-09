import { getSearxngURL } from './config/serverRegistry';

interface SearxngSearchOptions {
  categories?: string[];
  engines?: string[];
  language?: string;
  pageno?: number;
}

interface SearxngSearchResult {
  title: string;
  url: string;
  img_src?: string;
  thumbnail_src?: string;
  thumbnail?: string;
  content?: string;
  author?: string;
  iframe_src?: string;
}

const normalizeSearxngURL = (rawURL: string) => {
  const trimmed = rawURL.trim();
  if (!trimmed) {
    throw new Error('SearXNG URL is not configured');
  }

  return trimmed.endsWith('/') ? trimmed.slice(0, -1) : trimmed;
};

export const isSearxngError = (error: unknown): error is Error =>
  error instanceof Error && error.message.toLowerCase().includes('searxng');

export const searchSearxng = async (
  query: string,
  opts?: SearxngSearchOptions,
) => {
  const searxngURL = normalizeSearxngURL(getSearxngURL());

  const url = new URL(`${searxngURL}/search`);
  url.searchParams.append('format', 'json');
  url.searchParams.append('q', query);

  if (opts) {
    Object.keys(opts).forEach((key) => {
      const value = opts[key as keyof SearxngSearchOptions];
      if (value === undefined || value === null || value === '') {
        return;
      }

      if (Array.isArray(value)) {
        url.searchParams.append(key, value.join(','));
        return;
      }
      url.searchParams.append(key, value as string);
    });
  }

  const res = await fetch(url, {
    headers: {
      Accept: 'application/json',
      'User-Agent': 'Perplexica',
    },
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(
      `SearXNG request failed (${res.status} ${res.statusText}): ${body.slice(0, 200)}`,
    );
  }

  const contentType = res.headers.get('content-type') || '';
  if (!contentType.toLowerCase().includes('json')) {
    const body = await res.text();
    throw new Error(
      `SearXNG returned non-JSON content: ${body.slice(0, 200)}`,
    );
  }

  const data = await res.json();

  const results: SearxngSearchResult[] = Array.isArray(data.results)
    ? data.results
    : [];
  const suggestions: string[] = Array.isArray(data.suggestions)
    ? data.suggestions
    : [];

  return { results, suggestions };
};
