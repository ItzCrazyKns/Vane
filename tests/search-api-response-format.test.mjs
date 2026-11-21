import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import test from 'node:test';
import vm from 'node:vm';

const sources = Object.freeze([
  Object.freeze({
    content: 'Synthetic evidence for the first answer.',
    metadata: Object.freeze({
      title: 'First source',
      url: 'https://example.com/1',
      similarity: 1,
      embedding: Object.freeze([]),
    }),
  }),
  Object.freeze({
    content: 'Synthetic evidence for the second answer.',
    metadata: Object.freeze({
      title: 'Second source',
      url: 'https://example.com/2',
    }),
  }),
]);
const answerParts = ['A synthetic answer [', '1] and [2].'];
const metadataSources = sources.map(({ metadata }) => ({
  metadata: { title: metadata.title, url: metadata.url },
}));

// Load the real route while keeping model, research, and session work local.
async function loadRoute(findings) {
  const calls = { registry: 0, models: 0, search: 0 };
  class Session extends EventEmitter {
    static createSession() {
      return new Session();
    }
    subscribe(listener) {
      for (const event of ['data', 'end', 'error']) {
        this.on(event, (data) => listener(event, data));
      }
    }
  }
  class Registry {
    constructor() {
      calls.registry++;
    }
    async loadChatModel() {
      calls.models++;
      return {};
    }
    async loadEmbeddingModel() {
      calls.models++;
      return {};
    }
  }
  class Agent {
    async searchAsync(session) {
      calls.search++;
      queueMicrotask(() => {
        if (findings !== null) {
          session.emit('data', { type: 'searchResults', data: findings });
        }
        for (const data of answerParts) {
          session.emit('data', { type: 'response', data });
        }
        session.emit('end', {});
      });
    }
  }

  const context = vm.createContext({
    Response,
    ReadableStream,
    TextEncoder,
    AbortController,
    crypto,
    console,
  });
  const routeSource = readFileSync(
    new URL('../src/app/api/search/route.ts', import.meta.url),
    'utf8',
  );
  const route = new vm.SourceTextModule(
    stripTypeScriptTypes(routeSource, { mode: 'transform' }),
    { context },
  );
  const dependencies = new Map([
    ['@/lib/models/registry', { default: Registry }],
    ['@/lib/models/types', { ModelWithProvider: undefined }],
    ['@/lib/session', { default: Session }],
    ['@/lib/types', { ChatTurnMessage: undefined }],
    ['@/lib/agents/search/types', { SearchSources: undefined }],
    ['@/lib/agents/search/api', { default: Agent }],
  ]);
  await route.link(async (specifier) => {
    if (specifier === './responseFormat') {
      const formatSource = readFileSync(
        new URL('../src/app/api/search/responseFormat.ts', import.meta.url),
        'utf8',
      );
      const formatModule = new vm.SourceTextModule(
        stripTypeScriptTypes(formatSource, { mode: 'transform' }),
        { context },
      );
      await formatModule.link(() => {
        throw new Error('Unexpected runtime dependency in responseFormat');
      });
      return formatModule;
    }
    const exports = dependencies.get(specifier);
    assert.ok(exports, `Unexpected route dependency: ${specifier}`);
    return new vm.SyntheticModule(
      Object.keys(exports),
      function () {
        for (const [name, value] of Object.entries(exports)) {
          this.setExport(name, value);
        }
      },
      { context },
    );
  });
  await route.evaluate();
  return { post: route.namespace.POST, calls };
}

function searchRequest(responseFormat, stream) {
  return new Request('http://localhost/api/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      query: 'A synthetic question',
      sources: ['web'],
      chatModel: { providerId: 'stub', key: 'stub' },
      embeddingModel: { providerId: 'stub', key: 'stub' },
      responseFormat,
      stream,
    }),
  });
}

for (const format of [undefined, 'full', 'metadata-only', 'summary-only']) {
  for (const stream of [false, true]) {
    for (const findings of [sources, [], null]) {
      const resultCase =
        findings === null ? 'search skipped' : `${findings.length} sources`;
      test(`${format ?? 'omitted'} / ${stream ? 'stream' : 'JSON'} / ${resultCase}`, async () => {
        const { post, calls } = await loadRoute(findings);
        const response = await post(searchRequest(format, stream));
        assert.equal(response.status, 200);
        assert.deepEqual(calls, { registry: 1, models: 2, search: 1 });
        const expectedSources =
          format === 'metadata-only' && findings?.length
            ? metadataSources
            : (findings ?? []);

        if (!stream) {
          assert.deepEqual(
            await response.json(),
            format === 'summary-only'
              ? { message: answerParts.join('') }
              : { message: answerParts.join(''), sources: expectedSources },
          );
          return;
        }

        assert.equal(response.headers.get('content-type'), 'text/event-stream');
        const body = await response.text();
        assert.ok(body.endsWith('\n'));
        const events = body
          .trim()
          .split('\n')
          .map((line) => JSON.parse(line));
        const expected = [{ type: 'init', data: 'Stream connected' }];
        if (format !== 'summary-only' && findings !== null) {
          expected.push({ type: 'sources', data: expectedSources });
        }
        expected.push(
          ...answerParts.map((data) => ({ type: 'response', data })),
          { type: 'done' },
        );
        assert.deepEqual(events, expected);
      });
    }
  }
}

for (const invalid of [null, '', 'invalid', 0, false, [], {}]) {
  for (const stream of [false, true]) {
    test(`reject ${JSON.stringify(invalid)} before loading models / stream=${stream}`, async () => {
      const { post, calls } = await loadRoute(sources);
      const response = await post(searchRequest(invalid, stream));
      assert.equal(response.status, 400);
      assert.match((await response.json()).message, /Invalid responseFormat/);
      assert.deepEqual(calls, { registry: 0, models: 0, search: 0 });
    });
  }
}
