/** One article shown in the Discover feed and in the home news widget. */
export interface DiscoverItem {
  title: string;
  url: string;
  /** Short plain-text excerpt. */
  content: string;
  /** Image URL, when the source provides one. Cards render fine without it. */
  thumbnail?: string;
  /** Publisher host, e.g. "g1.globo.com". */
  source?: string;
  /** ISO 8601 publication date, when known. */
  publishedAt?: string;
}

/** Locales the Discover sources are curated for. */
export type DiscoverLocale = 'pt-BR' | 'en';

/**
 * A built-in Discover topic. RSS feeds are the main source; the SearXNG
 * queries only run when the feeds bring back too few articles.
 */
export interface DiscoverTopic {
  /** Stable id, also the i18n key under `Discover.topics`. */
  id: string;
  feeds: string[];
  fallback?: {
    sites: string[];
    queries: string[];
  };
}
