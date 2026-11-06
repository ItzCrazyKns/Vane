import { describe, expect, it, vi } from 'vitest';
import { FakeEmbedding, FakeLLM } from '@/__tests__/helpers/fakes';

/* Contract of POST /api/search (docs/API/SEARCH.md), with the whole
   pipeline running on fake models and a fake SearxNG. */

vi.mock('@/lib/searxng', () => ({
  searchSearxng: vi.fn(async () => ({
    results: [
      { title: 'Rust A', url: 'https://a.test/1', content: 'rust web memory' },
    ],
    suggestions: [],
  })),
}));

const makeLLM = () =>
  new FakeLLM({
    generateObject: () => ({
      classification: {
        skipSearch: false,
        personalSearch: false,
        academicSearch: false,
        discussionSearch: false,
        showWeatherWidget: false,
        showStockWidget: false,
        showCalculationWidget: false,
      },
      standaloneFollowUp: 'rust web',
    }),
    streamText: (input, i) =>
      (input.messages[0].content as string).includes('You are Vane')
        ? [
            { contentChunk: 'Rust ', toolCallChunk: [] },
            { contentChunk: 'é bom[1].', toolCallChunk: [] },
          ]
        : i === 0
          ? [
              {
                contentChunk: '',
                toolCallChunk: [
                  {
                    id: 'c1',
                    name: 'web_search',
                    arguments: { queries: ['rust web'] },
                  },
                ],
              },
            ]
          : [
              {
                contentChunk: '',
                toolCallChunk: [{ id: 'c2', name: 'done', arguments: {} }],
              },
            ],
  });

vi.mock('@/lib/models/registry', () => ({
  default: class {
    loadChatModel = async () => makeLLM();
    loadEmbeddingModel = async () => new FakeEmbedding();
  },
}));

import { POST } from '../route';

const body = (extra: Record<string, any> = {}) =>
  new Request('http://localhost/api/search', {
    method: 'POST',
    body: JSON.stringify({
      chatModel: { providerId: 'p', key: 'm' },
      embeddingModel: { providerId: 'p', key: 'e' },
      optimizationMode: 'speed',
      sources: ['web'],
      query: 'Rust para web?',
      history: [],
      ...extra,
    }),
  });

describe('POST /api/search', () => {
  it('returns message and sources without streaming', async () => {
    const res = await POST(body());
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.message).toBe('Rust é bom[1].');
    expect(json.sources).toEqual([
      {
        content: 'rust web memory',
        metadata: { title: 'Rust A', url: 'https://a.test/1' },
      },
    ]);
  });

  it('streams init, sources, response chunks and done', async () => {
    const res = await POST(body({ stream: true }));
    const text = await res.text();
    const lines = text
      .trim()
      .split('\n')
      .map((l) => JSON.parse(l));
    expect(lines.map((l) => l.type)).toEqual([
      'init',
      'sources',
      'response',
      'response',
      'done',
    ]);
  });

  it('rejects a request without sources or query', async () => {
    const res = await POST(
      new Request('http://localhost/api/search', {
        method: 'POST',
        body: JSON.stringify({ query: 'x' }),
      }),
    );
    expect(res.status).toBe(400);
  });
});
