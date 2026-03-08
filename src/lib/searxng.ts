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

  const res = await fetch(url);

  if (!res.ok) {
    throw new Error(
      `SearXNG returned status ${res.status} for query: ${query}`,
    );
  }

  let data;
  try {
    data = await res.json();
  } catch {
    throw new Error(`SearXNG returned non-JSON response for query: ${query}`);
  }

  const results: SearxngSearchResult[] = data.results ?? [];
  const suggestions: string[] = data.suggestions ?? [];

  return { results, suggestions };
};
