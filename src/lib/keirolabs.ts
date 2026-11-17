import { getKeirolabsAPIKey } from './config/serverRegistry';
import { searchSearxng, SearxngSearchOptions } from './searxng';

interface KeirolabsResult {
  title: string;
  url: string;
  snippet?: string;
}

export const searchKeirolabs = async (query: string, apiKey: string) => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);

  try {
    const res = await fetch('https://api.keirolabs.cloud/api/v2/search/lite', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query, maxResults: 15 }),
      signal: controller.signal,
    });

    if (!res.ok) {
      throw new Error(`Keirolabs error: ${res.status} ${res.statusText}`);
    }

    const data = await res.json();
    const results = ((data.results ?? []) as KeirolabsResult[]).map((r) => ({
      title: r.title,
      url: r.url,
      content: r.snippet,
    }));

    return { results, suggestions: [] as string[] };
  } catch (err: any) {
    if (err.name === 'AbortError') {
      throw new Error('Keirolabs search timed out');
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }
};

/**
 * Web search goes to Keirolabs when an API key is configured. Searches pinned
 * to SearXNG engines or categories (academic, social) stay on SearXNG.
 */
export const searchWeb = (query: string, opts?: SearxngSearchOptions) => {
  const apiKey = getKeirolabsAPIKey();
  if (apiKey && !opts?.engines?.length && !opts?.categories?.length) {
    return searchKeirolabs(query, apiKey);
  }
  return searchSearxng(query, opts);
};
