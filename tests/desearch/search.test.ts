import assert from 'node:assert/strict';
import { afterEach, test, mock } from 'node:test';
import { searchDesearch } from '../../src/lib/desearch';
import { createWebSearch } from '../../src/lib/searchBackend';

const originalFetch = globalThis.fetch;
const originalKey = process.env.DESEARCH_API_KEY;
afterEach(() => {
  globalThis.fetch = originalFetch;
  if (originalKey === undefined) delete process.env.DESEARCH_API_KEY;
  else process.env.DESEARCH_API_KEY = originalKey;
  mock.restoreAll();
});

function respond(body: unknown, status = 200) {
  process.env.DESEARCH_API_KEY = 'unit-test-credential';
  const fetch = mock.fn(
    async (_url: URL | RequestInfo, _options?: RequestInit) =>
      new Response(JSON.stringify(body), { status }),
  );
  globalThis.fetch = fetch as typeof globalThis.fetch;
  return fetch;
}

test('encodes query, sends bearer header, and maps results', async () => {
  const fetch = respond({
    data: [
      { title: 'A title', link: 'https://example.org', snippet: 'A snippet' },
    ],
  });
  assert.deepEqual(await searchDesearch('a & b/雪', 3), {
    results: [
      { title: 'A title', url: 'https://example.org', content: 'A snippet' },
    ],
    suggestions: [],
  });
  const [url, options] = fetch.mock.calls[0].arguments as unknown as [
    URL,
    RequestInit,
  ];
  assert.equal(url.origin + url.pathname, 'https://api.desearch.ai/web');
  assert.equal(url.searchParams.get('query'), 'a & b/雪');
  assert.equal(url.searchParams.get('num'), '3');
  assert.equal(options.method, 'GET');
  assert.deepEqual(options.headers, {
    Authorization: 'Bearer unit-test-credential',
  });
  assert.equal(options.redirect, 'error');
  assert.ok(options.signal instanceof AbortSignal);
});

test('supports empty responses and defaults to ten results', async () => {
  const fetch = respond({ data: [] });
  assert.deepEqual(await searchDesearch('empty'), {
    results: [],
    suggestions: [],
  });
  assert.equal(
    (fetch.mock.calls[0].arguments[0] as unknown as URL).searchParams.get(
      'num',
    ),
    '10',
  );
});

test('missing key and invalid counts make no HTTP requests', async () => {
  const fetch = respond({ data: [] });
  delete process.env.DESEARCH_API_KEY;
  await assert.rejects(searchDesearch('q'), /DESEARCH_API_KEY is required/);
  process.env.DESEARCH_API_KEY = 'unit-test-credential';
  for (const num of [0, -1, 1.5, NaN]) {
    await assert.rejects(searchDesearch('q', num), /positive integer/);
  }
  assert.equal(fetch.mock.callCount(), 0);
});

test('reads the key from env on each request', async () => {
  respond({ data: [] });
  await searchDesearch('q');
  delete process.env.DESEARCH_API_KEY;
  await assert.rejects(searchDesearch('q'), /DESEARCH_API_KEY is required/);
});

test('HTTP errors expose only status', async () => {
  const fetch = respond({ error: 'sensitive body' }, 401);
  await assert.rejects(searchDesearch('q'), { message: 'Desearch HTTP 401' });
  assert.equal(fetch.mock.callCount(), 1);
});

test('rejects malformed payloads', async () => {
  for (const body of [
    null,
    {},
    { data: {} },
    { data: [null] },
    { data: [{ title: 'x', link: 'y' }] },
  ]) {
    respond(body);
    await assert.rejects(searchDesearch('q'), {
      message: 'Invalid Desearch response',
    });
  }
});

test('sanitizes transport and JSON errors', async () => {
  process.env.DESEARCH_API_KEY = 'unit-test-credential';
  globalThis.fetch = mock.fn(async () => {
    throw new Error('sensitive transport details');
  });
  await assert.rejects(searchDesearch('q'), {
    message: 'Desearch search failed',
  });
  globalThis.fetch = mock.fn(async () => new Response('invalid JSON'));
  await assert.rejects(searchDesearch('q'), {
    message: 'Desearch search failed',
  });
});

test('aborts slow requests', async () => {
  process.env.DESEARCH_API_KEY = 'unit-test-credential';
  mock.timers.enable({ apis: ['setTimeout'] });
  globalThis.fetch = mock.fn(
    async (_url, options) =>
      new Promise<Response>((_resolve, reject) => {
        options?.signal?.addEventListener('abort', () =>
          reject(new Error('aborted')),
        );
      }),
  );
  const request = searchDesearch('q');
  mock.timers.tick(10000);
  await assert.rejects(request, { message: 'Desearch search timed out' });
  mock.timers.reset();
});

test('routes by config and preserves default search options', async () => {
  let backend = 'searxng';
  const fallback = mock.fn(
    async (
      _query: string,
      _opts?: import('../../src/lib/searchTypes').SearxngSearchOptions,
    ) => ({ results: [], suggestions: [] as string[] }),
  );
  const desearch = mock.fn(async (_query: string) => ({
    results: [],
    suggestions: [] as string[],
  }));
  const search = createWebSearch(() => backend, fallback, desearch);
  const opts = { categories: ['general'], language: 'en', pageno: 2 };
  await search('default query', opts);
  assert.deepEqual(fallback.mock.calls[0].arguments, ['default query', opts]);
  assert.equal(desearch.mock.callCount(), 0);
  backend = 'desearch';
  await search('optional query', opts);
  assert.deepEqual(desearch.mock.calls[0].arguments, ['optional query']);
  assert.equal(fallback.mock.callCount(), 1);
});

test('unknown and empty backends fall back to searxng with search options', async () => {
  const result = { results: [], suggestions: ['suggestion'] };
  const fallback = mock.fn(async (_query: string, _opts?: unknown) => result);
  const desearch = mock.fn(async (_query: string) => result);
  const opts = { categories: ['general'], language: 'en', pageno: 2 };

  for (const backend of ['unknown', '']) {
    const search = createWebSearch(() => backend, fallback, desearch);
    assert.equal(await search('fallback query', opts), result);
  }

  assert.equal(fallback.mock.callCount(), 2);
  for (const call of fallback.mock.calls) {
    assert.deepEqual(call.arguments, ['fallback query', opts]);
  }
  assert.equal(desearch.mock.callCount(), 0);
});
