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

export type BifrostConfig = {
  enabled: boolean;
  /** Gateway base URL without a trailing slash or /v1. */
  url: string;
  virtualKey: string;
  mcpEnabled: boolean;
  /** Allowed MCP tool name patterns; empty means read-only tools only. */
  mcpTools: string[];
};

const asBool = (v: unknown) => v === true || v === 'true';

export const normalizeBifrostURL = (raw: unknown): string =>
  String(raw ?? '')
    .trim()
    .replace(/\/+$/, '')
    .replace(/\/v1$/, '');

export const getBifrostConfig = (): BifrostConfig => {
  const raw = configManager.getConfig('bifrost', {}) ?? {};
  const url = normalizeBifrostURL(raw.url);

  return {
    /* Without a URL the gateway can't be reached, so the flag alone does nothing. */
    enabled: asBool(raw.enabled) && url !== '',
    url,
    virtualKey: String(raw.virtualKey ?? '').trim(),
    mcpEnabled: asBool(raw.mcpEnabled),
    mcpTools: String(raw.mcpTools ?? '')
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean),
  };
};
