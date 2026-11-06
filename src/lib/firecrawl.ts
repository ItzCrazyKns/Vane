import { getFirecrawlURL } from './config/serverRegistry';

export type FirecrawlConfig = { apiURL: string; apiKey?: string };

/**
 * Where to reach Firecrawl, or null when it is not configured.
 * The URL comes from settings (seeded by FIRECRAWL_API_URL); the optional
 * key only from FIRECRAWL_API_KEY, so it is never exposed through the
 * settings API.
 */
export const getFirecrawlConfig = (): FirecrawlConfig | null => {
  const apiURL = getFirecrawlURL();
  if (!apiURL) return null;

  return {
    apiURL: apiURL.replace(/\/+$/, ''),
    apiKey: process.env.FIRECRAWL_API_KEY?.trim() || undefined,
  };
};

export const firecrawlHeaders = (apiKey?: string): Record<string, string> => {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;
  return headers;
};
