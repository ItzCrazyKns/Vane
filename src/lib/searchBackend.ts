import { searchDesearch } from './desearch';
import type { SearxngSearchOptions, SearxngSearchResult } from './searchTypes';

type DefaultSearch = (
  query: string,
  opts?: SearxngSearchOptions,
) => Promise<{
  results: SearxngSearchResult[];
  suggestions: string[];
}>;

// Keep backend selection independent of the application config and model registry.
export const createWebSearch =
  (
    getBackend: () => string,
    defaultSearch: DefaultSearch,
    desearch = searchDesearch,
  ) =>
  async (query: string, opts?: SearxngSearchOptions) => {
    const backend = getBackend();
    if (backend === 'desearch') return desearch(query);
    return defaultSearch(query, opts);
  };
