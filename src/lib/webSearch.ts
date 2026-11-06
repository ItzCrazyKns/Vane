import { getSearchProvider } from './config/serverRegistry';
import { searchFirecrawl } from './firecrawlSearch';
import { searchSearxng, SearxngSearchOptions } from './searxng';
import { SearchHttpError } from './searchErrors';

/** Searches allowed in flight at once, across all research actions. */
const DEFAULT_SEARCH_CONCURRENCY = 2;
/** Statuses that usually mean "slow down" (rate limit, bot block, overload). */
const RETRYABLE_STATUSES = [403, 429, 502, 503, 504];
/** Longest Retry-After we are willing to honour. */
const MAX_RETRY_AFTER_MS = 10000;

/** Pause before each retry; exported so tests can shorten it. */
export const searchRetry = { delaysMs: [1000, 3000] };

const getConcurrency = () => {
  const value = parseInt(process.env.SEARCH_CONCURRENCY ?? '', 10);
  return Number.isFinite(value) && value > 0
    ? value
    : DEFAULT_SEARCH_CONCURRENCY;
};

let active = 0;
const waiting: (() => void)[] = [];

const acquire = async () => {
  if (active < getConcurrency()) {
    active += 1;
    return;
  }
  await new Promise<void>((resolve) => waiting.push(resolve));
};

const release = () => {
  const next = waiting.shift();
  if (next) {
    next(); /* hand the slot straight over */
  } else {
    active -= 1;
  }
};

const withSlot = async <T>(fn: () => Promise<T>): Promise<T> => {
  await acquire();
  try {
    return await fn();
  } finally {
    release();
  }
};

const isRetryable = (err: unknown) =>
  (err instanceof SearchHttpError && RETRYABLE_STATUSES.includes(err.status)) ||
  (err instanceof Error && /timed out/i.test(err.message));

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const runProvider = (query: string, opts?: SearxngSearchOptions) =>
  getSearchProvider() === 'firecrawl'
    ? searchFirecrawl(query, opts)
    : searchSearxng(query, opts);

/**
 * Web search used by the researcher. Runs on the provider chosen in
 * Settings > Search (SearXNG by default, or Firecrawl).
 * Image, video and Discover searches still call SearXNG directly.
 *
 * At most SEARCH_CONCURRENCY (default 2) searches run at once, so a
 * research step firing many queries does not trip SearXNG's bot detection
 * or the upstream engines' rate limits. A 403/429/5xx or a timeout is
 * retried twice, after 1 s and 3 s (or the server's Retry-After), without
 * holding a slot while waiting.
 */
export const searchWeb = async (query: string, opts?: SearxngSearchOptions) => {
  for (let attempt = 0; ; attempt++) {
    try {
      return await withSlot(() => runProvider(query, opts));
    } catch (err) {
      const delay = searchRetry.delaysMs[attempt];
      if (delay === undefined || !isRetryable(err)) throw err;

      const retryAfter =
        err instanceof SearchHttpError && err.retryAfterMs !== undefined
          ? Math.min(err.retryAfterMs, MAX_RETRY_AFTER_MS)
          : undefined;

      console.log(
        `[search] "${query}" failed (${(err as Error).message}); retrying in ${retryAfter ?? delay} ms`,
      );
      await sleep(retryAfter ?? delay);
    }
  }
};
