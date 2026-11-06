import { getFirecrawlConfig, firecrawlHeaders } from './firecrawl';
import { SearchHttpError, parseRetryAfter } from './searchErrors';
import type { SearxngSearchOptions, SearxngSearchResult } from './searxng';

type FirecrawlWebResult = {
  url?: string;
  title?: string;
  description?: string;
  markdown?: string;
};

type FirecrawlSearchResponse = {
  success?: boolean;
  error?: string;
  data?: { web?: FirecrawlWebResult[] } | FirecrawlWebResult[];
};

/** Results requested per query. SearXNG returns ~20; fewer keeps speed mode cheap. */
export const FIRECRAWL_SEARCH_LIMIT = 10;
/** Time Firecrawl may spend on a search (sent in the request). */
export const FIRECRAWL_SEARCH_TIMEOUT_MS = 15000;
const RESPONSE_GRACE_MS = 5000;

const ACADEMIC_ENGINES = ['arxiv', 'google scholar', 'pubmed'];

/**
 * Translates the SearXNG options the researcher actions use into Firecrawl's
 * /v2/search body. SearXNG engines have no Firecrawl equivalent, so:
 * - academic engines map to the `research` category;
 * - `reddit` becomes a `site:reddit.com` filter on the query.
 */
export const buildFirecrawlSearchBody = (
  query: string,
  opts?: SearxngSearchOptions,
) => {
  const engines = (opts?.engines ?? []).map((e) => e.toLowerCase());
  let q = query;

  if (engines.includes('reddit') && !/site:reddit\.com/i.test(q)) {
    q = `${q} site:reddit.com`;
  }

  const body: Record<string, unknown> = {
    query: q,
    limit: FIRECRAWL_SEARCH_LIMIT,
    sources: ['web'],
    timeout: FIRECRAWL_SEARCH_TIMEOUT_MS,
  };

  if (engines.some((e) => ACADEMIC_ENGINES.includes(e))) {
    body.categories = ['research'];
  }

  if (opts?.language) {
    body.lang = opts.language;
  }

  /* SearXNG's time_range in Google's tbs form, which Firecrawl accepts. */
  if (opts?.time_range) {
    body.tbs = `qdr:${opts.time_range[0]}`;
  }

  return body;
};

/**
 * Web search through Firecrawl's /v2/search, returning the same shape as
 * `searchSearxng` so callers do not care which provider ran.
 * Only snippets are requested (no scrapeOptions), which keeps it fast.
 */
export const searchFirecrawl = async (
  query: string,
  opts?: SearxngSearchOptions,
): Promise<{ results: SearxngSearchResult[]; suggestions: string[] }> => {
  const firecrawl = getFirecrawlConfig();

  if (!firecrawl) {
    throw new Error(
      'Firecrawl search is selected but no Firecrawl URL is configured',
    );
  }

  let res: Response;
  try {
    res = await fetch(`${firecrawl.apiURL}/v2/search`, {
      method: 'POST',
      headers: firecrawlHeaders(firecrawl.apiKey),
      body: JSON.stringify(buildFirecrawlSearchBody(query, opts)),
      signal: AbortSignal.timeout(
        FIRECRAWL_SEARCH_TIMEOUT_MS + RESPONSE_GRACE_MS,
      ),
    });
  } catch (err: any) {
    if (err?.name === 'AbortError' || err?.name === 'TimeoutError') {
      throw new Error('Firecrawl search timed out');
    }
    throw err;
  }

  const body = (await res
    .json()
    .catch(() => null)) as FirecrawlSearchResponse | null;

  if (!res.ok || !body?.success) {
    throw new SearchHttpError(
      `Firecrawl search error: ${res.status}${body?.error ? ` ${body.error}` : ''}`,
      res.status,
      parseRetryAfter(res.headers?.get?.('retry-after')),
    );
  }

  const web = Array.isArray(body.data) ? body.data : (body.data?.web ?? []);

  const results: SearxngSearchResult[] = web
    .filter((r): r is FirecrawlWebResult & { url: string } => !!r?.url)
    .map((r) => ({
      url: r.url,
      title: r.title?.trim() || r.url,
      content: r.description?.trim() || undefined,
    }));

  return { results, suggestions: [] };
};
