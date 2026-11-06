import configManager from './index';
import { ConfigModelProvider } from './types';

export const getConfiguredModelProviders = (): ConfigModelProvider[] => {
  return configManager.getConfig('modelProviders', []);
};

export const getConfiguredModelProviderById = (
  id: string,
): ConfigModelProvider | undefined => {
  return getConfiguredModelProviders().find((p) => p.id === id) ?? undefined;
};

export const getSearxngURL = () =>
  configManager.getConfig('search.searxngURL', '');

export type SearchProvider = 'searxng' | 'firecrawl';

export const getSearchProvider = (): SearchProvider =>
  configManager.getConfig('search.provider', 'searxng') === 'firecrawl'
    ? 'firecrawl'
    : 'searxng';

/**
 * Firecrawl base URL: the value saved in settings wins, then the
 * FIRECRAWL_API_URL env var (which also seeds the setting on first start).
 */
export const getFirecrawlURL = (): string =>
  String(
    configManager.getConfig('search.firecrawlURL', '') ||
      process.env.FIRECRAWL_API_URL ||
      '',
  ).trim();
