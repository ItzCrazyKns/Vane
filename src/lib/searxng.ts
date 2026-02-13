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

export const searchSearxng = async (
  query: string,
  opts?: SearxngSearchOptions,
) => {
  const searxngURL = getSearxngURL();

  const baseURL = searxngURL.endsWith('/')
    ? searxngURL.slice(0, -1)
    : searxngURL;

  const url = new URL(`${baseURL}/search?format=json`);
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

  const res = await fetch(url);
  const text = await res.text();

  let data;
  try {
    data = JSON.parse(text);
  } catch (err) {
    if (text.trim().startsWith('<!doctype html') || text.trim().startsWith('<html')) {
      throw new Error(
        'SearXNG returned an HTML response instead of JSON. ' +
        'Please ensure that JSON output is enabled in your SearXNG settings (e.g., SEARXNG_SETTINGS_SEARCH__FORMATS=["html", "json"]).'
      );
    }
    throw new Error(`Failed to parse SearXNG response as JSON: ${err instanceof Error ? err.message : String(err)}`);
  }

  const results: SearxngSearchResult[] = data.results || [];
  const suggestions: string[] = data.suggestions || [];

  return { results, suggestions };
};
