import { beforeEach, describe, expect, it, vi } from 'vitest';

const provider = vi.hoisted(() => ({ value: 'searxng' }));

vi.mock('@/lib/config/serverRegistry', () => ({
  getSearchProvider: () => provider.value,
}));
vi.mock('@/lib/searxng', () => ({
  searchSearxng: vi.fn(async () => ({ results: [], suggestions: ['s'] })),
}));
vi.mock('@/lib/firecrawlSearch', () => ({
  searchFirecrawl: vi.fn(async () => ({ results: [], suggestions: [] })),
}));

import { searchWeb } from '../webSearch';
import { searchSearxng } from '../searxng';
import { searchFirecrawl } from '../firecrawlSearch';

describe('searchWeb', () => {
  beforeEach(() => {
    vi.mocked(searchSearxng).mockClear();
    vi.mocked(searchFirecrawl).mockClear();
  });

  it('uses SearXNG by default', async () => {
    provider.value = 'searxng';
    await searchWeb('q', { engines: ['reddit'] });
    expect(searchSearxng).toHaveBeenCalledWith('q', { engines: ['reddit'] });
    expect(searchFirecrawl).not.toHaveBeenCalled();
  });

  it('uses Firecrawl when selected', async () => {
    provider.value = 'firecrawl';
    await searchWeb('q');
    expect(searchFirecrawl).toHaveBeenCalledWith('q', undefined);
    expect(searchSearxng).not.toHaveBeenCalled();
  });
});
