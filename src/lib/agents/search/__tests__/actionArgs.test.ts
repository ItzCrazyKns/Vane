/* The model sometimes omits an array argument or sends a string instead
   (upstream issue #964 / PR #1091): `params.urls.slice` threw. */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  FakeEmbedding,
  FakeLLM,
  createFakeSession,
} from '@/__tests__/helpers/fakes';

const scrapeMock = vi.fn();
vi.mock('@/lib/scraper', () => ({
  default: { scrape: (url: string) => scrapeMock(url) },
}));

const uploadQueryMock = vi.fn();
vi.mock('@/lib/uploads/store', () => ({
  default: class {
    query(queries: string[], k: number) {
      return uploadQueryMock(queries, k);
    }
  },
}));

import scrapeURLAction from '../researcher/actions/scrapeURL';
import uploadsSearchAction from '../researcher/actions/uploadsSearch';

const config = () => {
  const session = createFakeSession();
  session.emitBlock({
    id: 'research',
    type: 'research',
    data: { subSteps: [] },
  });
  return {
    session: session as any,
    llm: new FakeLLM({}),
    embedding: new FakeEmbedding(),
    researchBlockId: 'research',
    fileIds: ['f1'],
    mode: 'balanced' as const,
  } as any;
};

describe('scrape_url argument guard', () => {
  beforeEach(() => {
    scrapeMock.mockReset();
    scrapeMock.mockImplementation(async (url: string) => ({
      title: url,
      content: `body of ${url}`,
    }));
  });

  it.each([undefined, null, 42, {}])(
    'returns no results when urls is %s',
    async (urls) => {
      const out = await scrapeURLAction.execute({ urls } as any, config());
      expect(out).toMatchObject({ type: 'search_results', results: [] });
      expect(scrapeMock).not.toHaveBeenCalled();
    },
  );

  it('accepts a single URL string', async () => {
    const out = await scrapeURLAction.execute(
      { urls: 'https://a.test' } as any,
      config(),
    );
    expect(scrapeMock).toHaveBeenCalledWith('https://a.test');
    expect((out as any).results).toHaveLength(1);
  });

  it('drops non-strings, blanks and repeats, and keeps at most three', async () => {
    await scrapeURLAction.execute(
      {
        urls: [
          ' https://a.test ',
          '',
          7,
          'https://a.test',
          'https://b.test',
          'https://c.test',
          'https://d.test',
        ],
      } as any,
      config(),
    );
    expect(scrapeMock.mock.calls.map((c) => c[0]).sort()).toEqual([
      'https://a.test',
      'https://b.test',
      'https://c.test',
    ]);
  });
});

describe('uploads_search argument guard', () => {
  beforeEach(() => {
    uploadQueryMock.mockReset();
    uploadQueryMock.mockResolvedValue([]);
  });

  it.each([undefined, null, 42])(
    'searches nothing when queries is %s',
    async (queries) => {
      const out = await uploadsSearchAction.execute(
        { queries } as any,
        config(),
      );
      expect(out).toMatchObject({ type: 'search_results', results: [] });
      expect(uploadQueryMock).not.toHaveBeenCalled();
    },
  );

  it('accepts a single query string', async () => {
    await uploadsSearchAction.execute({ queries: 'budget' } as any, config());
    expect(uploadQueryMock).toHaveBeenCalledWith(['budget'], 10);
  });
});
