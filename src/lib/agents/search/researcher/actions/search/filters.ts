import type { SearxngSearchOptions, SearxngSearchResult } from '@/lib/searxng';

/**
 * Optional filters the researcher may attach to a web_search call, in the
 * spirit of Perplexity's search_recency_filter / search_domain_filter /
 * language filter. All of them are optional and invalid values are
 * ignored, so a small model that sends garbage still gets a plain search.
 */

export const RECENCY_VALUES = ['day', 'week', 'month', 'year'] as const;
export type Recency = (typeof RECENCY_VALUES)[number];

/** Domains a single call may restrict to or exclude. */
export const MAX_FILTER_DOMAINS = 10;

export type SearchFilters = {
  recency?: Recency;
  /** Hosts to restrict results to (empty means no restriction). */
  includeDomains: string[];
  /** Hosts whose results are dropped. */
  excludeDomains: string[];
  /** ISO 639-1 code, e.g. "pt" or "en". */
  language?: string;
};

const DOMAIN_RE = /^(?=.{1,253}$)([a-z0-9-]+\.)+[a-z]{2,63}$/;

/** "https://www.Example.com/path" -> "example.com"; invalid -> undefined. */
export const normalizeDomain = (raw: unknown): string | undefined => {
  if (typeof raw !== 'string') return undefined;
  let d = raw.trim().toLowerCase();
  d = d.replace(/^[a-z]+:\/\//, '').replace(/^site:/, '');
  d = d
    .split(/[/?#]/)[0]
    .replace(/:\d+$/, '')
    .replace(/^www\./, '');
  d = d.replace(/\.$/, '');
  return DOMAIN_RE.test(d) ? d : undefined;
};

/**
 * Reads the filter arguments of a web_search call. `domains` entries that
 * start with "-" are exclusions, the others an allow list (as in
 * Perplexity's search_domain_filter).
 */
export const parseSearchFilters = (input: {
  recency?: unknown;
  domains?: unknown;
  language?: unknown;
}): SearchFilters => {
  const filters: SearchFilters = { includeDomains: [], excludeDomains: [] };

  if (
    typeof input.recency === 'string' &&
    (RECENCY_VALUES as readonly string[]).includes(input.recency)
  ) {
    filters.recency = input.recency as Recency;
  }

  const rawDomains = Array.isArray(input.domains)
    ? input.domains
    : typeof input.domains === 'string'
      ? input.domains.split(',')
      : [];

  for (const entry of rawDomains) {
    if (typeof entry !== 'string') continue;
    const trimmed = entry.trim();
    const exclude = trimmed.startsWith('-');
    const domain = normalizeDomain(exclude ? trimmed.slice(1) : trimmed);
    if (!domain) continue;
    const list = exclude ? filters.excludeDomains : filters.includeDomains;
    if (
      !list.includes(domain) &&
      filters.includeDomains.length + filters.excludeDomains.length <
        MAX_FILTER_DOMAINS
    ) {
      list.push(domain);
    }
  }

  if (
    typeof input.language === 'string' &&
    /^[a-z]{2}$/i.test(input.language.trim())
  ) {
    filters.language = input.language.trim().toLowerCase();
  }

  return filters;
};

export const hasFilters = (f: SearchFilters) =>
  !!f.recency ||
  !!f.language ||
  f.includeDomains.length > 0 ||
  f.excludeDomains.length > 0;

/**
 * Adds site: operators to a query. Engines that ignore them are covered by
 * `filterResultsByDomain`, which enforces the same rule on the results.
 */
export const applyDomainOperators = (query: string, f: SearchFilters) => {
  let q = query;
  if (f.includeDomains.length === 1) {
    q = `${q} site:${f.includeDomains[0]}`;
  } else if (f.includeDomains.length > 1) {
    q = `${q} (${f.includeDomains.map((d) => `site:${d}`).join(' OR ')})`;
  }
  for (const d of f.excludeDomains) q = `${q} -site:${d}`;
  return q;
};

const hostOf = (url: string) => {
  try {
    return new URL(url).hostname.toLowerCase().replace(/^www\./, '');
  } catch {
    return undefined;
  }
};

const matches = (host: string, domain: string) =>
  host === domain || host.endsWith(`.${domain}`);

/** Enforces the domain filters on results, whatever the engine did. */
export const filterResultsByDomain = <
  T extends Pick<SearxngSearchResult, 'url'>,
>(
  results: T[],
  f: SearchFilters,
): T[] =>
  results.filter((r) => {
    const host = hostOf(r.url);
    if (!host) return f.includeDomains.length === 0;
    if (f.excludeDomains.some((d) => matches(host, d))) return false;
    if (f.includeDomains.length === 0) return true;
    return f.includeDomains.some((d) => matches(host, d));
  });

/** The provider options a filter set translates to (time range, language). */
export const toSearchOptions = (f: SearchFilters): SearxngSearchOptions => ({
  ...(f.recency ? { time_range: f.recency } : {}),
  ...(f.language ? { language: f.language } : {}),
});

export const FILTERS_TOOL_GUIDE = `
Optional filters (use them only when they clearly help):
- "recency": "day" | "week" | "month" | "year". Only results published in that period. Use for news, prices, releases, "latest", "this week", etc.
- "domains": up to ${MAX_FILTER_DOMAINS} domains. Plain entries restrict results to those sites (e.g. ["gov.br"] or ["arxiv.org", "nature.com"]); entries starting with "-" exclude a site (e.g. ["-pinterest.com"]). Use when the user names a site or asks for official sources.
- "language": two-letter ISO 639-1 code of the pages you want (e.g. "pt", "en").
If a filtered search returns nothing useful, search again without the filter.
`;
