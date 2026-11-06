import { getSearchProvider } from './config/serverRegistry';
import { searchFirecrawl } from './firecrawlSearch';
import { searchSearxng, SearxngSearchOptions } from './searxng';

/**
 * Web search used by the researcher. Runs on the provider chosen in
 * Settings > Search (SearXNG by default, or Firecrawl).
 * Image, video and Discover searches still call SearXNG directly.
 */
export const searchWeb = (query: string, opts?: SearxngSearchOptions) =>
  getSearchProvider() === 'firecrawl'
    ? searchFirecrawl(query, opts)
    : searchSearxng(query, opts);
