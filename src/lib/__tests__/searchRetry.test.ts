import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/config/serverRegistry', () => ({
  getSearchProvider: () => 'searxng',
}));
vi.mock('@/lib/searxng', () => ({ searchSearxng: vi.fn() }));
vi.mock('@/lib/firecrawlSearch', () => ({ searchFirecrawl: vi.fn() }));

import { searchWeb, searchRetry } from '../webSearch';
import { searchSearxng } from '../searxng';
import { SearchHttpError, parseRetryAfter } from '../searchErrors';

const ok = { results: [], suggestions: [] };

describe('searchWeb retries and concurrency', () => {
  const original = [...searchRetry.delaysMs];

  beforeEach(() => {
    vi.mocked(searchSearxng).mockReset();
    searchRetry.delaysMs = [1, 1];
    delete process.env.SEARCH_CONCURRENCY;
  });
  afterEach(() => {
    searchRetry.delaysMs = original;
  });

  it('retries a rate limit and succeeds', async () => {
    vi.mocked(searchSearxng)
      .mockRejectedValueOnce(
        new SearchHttpError('SearXNG error: Too Many Requests', 429),
      )
      .mockResolvedValueOnce(ok);

    await expect(searchWeb('q')).resolves.toBe(ok);
    expect(searchSearxng).toHaveBeenCalledTimes(2);
  });

  it('gives up after two retries', async () => {
    vi.mocked(searchSearxng).mockRejectedValue(
      new SearchHttpError('SearXNG error: Forbidden', 403),
    );
    await expect(searchWeb('q')).rejects.toThrow('Forbidden');
    expect(searchSearxng).toHaveBeenCalledTimes(3);
  });

  it('does not retry other errors', async () => {
    vi.mocked(searchSearxng).mockRejectedValue(
      new SearchHttpError('SearXNG error: Bad Request', 400),
    );
    await expect(searchWeb('q')).rejects.toThrow('Bad Request');
    expect(searchSearxng).toHaveBeenCalledTimes(1);
  });

  it('runs at most SEARCH_CONCURRENCY searches at once', async () => {
    process.env.SEARCH_CONCURRENCY = '2';
    let running = 0;
    let peak = 0;
    vi.mocked(searchSearxng).mockImplementation(async () => {
      running += 1;
      peak = Math.max(peak, running);
      await new Promise((r) => setTimeout(r, 5));
      running -= 1;
      return ok;
    });

    await Promise.all(Array.from({ length: 7 }, (_, i) => searchWeb(`q${i}`)));

    expect(searchSearxng).toHaveBeenCalledTimes(7);
    expect(peak).toBe(2);
  });
});

describe('parseRetryAfter', () => {
  it('reads seconds and ignores junk', () => {
    expect(parseRetryAfter('3')).toBe(3000);
    expect(parseRetryAfter(null)).toBeUndefined();
    expect(parseRetryAfter('soon')).toBeUndefined();
  });
});
