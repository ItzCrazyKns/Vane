/* Suggestion 23 of the Perplexity comparison: the source block appears
   with the first search results and is updated as the research goes on,
   instead of only at the end. */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  FakeEmbedding,
  FakeLLM,
  createFakeSession,
} from '@/__tests__/helpers/fakes';

vi.mock('@/lib/searxng', () => ({ searchSearxng: vi.fn() }));

import { searchSearxng } from '@/lib/searxng';
import Researcher, { mergeSearchFindings } from '../researcher';

const call = (id: string, name: string, args: any) => ({
  contentChunk: '',
  toolCallChunk: [{ id, name, arguments: args }],
});

const research = (llm: FakeLLM, session = createFakeSession()) =>
  new Researcher().research(session as any, {
    chatHistory: [],
    followUp: 'rust?',
    classification: {
      classification: {
        skipSearch: false,
        personalSearch: false,
        academicSearch: false,
        discussionSearch: false,
        showWeatherWidget: false,
        showStockWidget: false,
        showCalculationWidget: false,
      },
      standaloneFollowUp: 'Is Rust good for web?',
    },
    config: {
      sources: ['web'],
      fileIds: [],
      llm,
      embedding: new FakeEmbedding(),
      mode: 'balanced',
      systemInstructions: '',
    },
  });

describe('mergeSearchFindings', () => {
  it('keeps one entry per URL and does not touch the inputs', () => {
    const a = {
      content: 'one',
      metadata: { url: 'https://a.test', title: 'A' },
    };
    const a2 = {
      content: 'two',
      metadata: { url: 'https://a.test', title: 'A' },
    };
    const noUrl = { content: 'file', metadata: { title: 'F' } };
    const output = [
      { type: 'search_results' as const, results: [a, noUrl] },
      { type: 'done' as const },
      { type: 'search_results' as const, results: [a2] },
    ];

    const first = mergeSearchFindings(output as any);
    const second = mergeSearchFindings(output as any);

    expect(first.map((c) => c.content)).toEqual(['one\n\ntwo', 'file']);
    // Running it again gives the same result: no text appended twice.
    expect(second.map((c) => c.content)).toEqual(['one\n\ntwo', 'file']);
    expect(a.content).toBe('one');
  });
});

describe('Researcher source block', () => {
  beforeEach(() => {
    vi.mocked(searchSearxng).mockReset();
  });

  it('emits sources after the first search and updates the same block', async () => {
    vi.mocked(searchSearxng).mockImplementation(async (q: string) => ({
      results: [
        {
          title: q,
          url: `https://${q.replace(/\W/g, '')}.test/`,
          content: `rust ${q}`,
        },
      ],
      suggestions: [],
    }));
    const llm = new FakeLLM({
      streamText: (_input, i) =>
        i === 0
          ? [call('c1', 'web_search', { queries: ['rust web'] })]
          : i === 1
            ? [call('c2', 'web_search', { queries: ['rust async'] })]
            : [call('c3', 'done', {})],
    });
    const session = createFakeSession();

    const out = await research(llm, session);

    const urls = (chunks: any[]) => chunks.map((c) => c.metadata.url);

    // Created once, after the first search, with what it had found.
    const created = session.events.filter(
      (e) => e.data?.type === 'block' && e.data.block.type === 'source',
    );
    expect(created).toHaveLength(1);
    const blockId = created[0].data.block.id;
    expect(urls(created[0].data.block.data)).toEqual(['https://rustweb.test/']);

    // Then replaced in place as the research found more.
    const updates = session.events.filter(
      (e) => e.data?.type === 'updateBlock' && e.data.blockId === blockId,
    );
    expect(updates.length).toBeGreaterThan(0);
    const last = updates[updates.length - 1].data.patch[0];
    expect(last).toMatchObject({ op: 'replace', path: '/data' });
    expect(urls(last.value)).toEqual([
      'https://rustweb.test/',
      'https://rustasync.test/',
    ]);
    expect(out.searchFindings).toEqual(last.value);

    // The creation came before the second search ran.
    const createdAt = session.events.indexOf(created[0]);
    const secondSearchStep = session.events.findIndex(
      (e, i) =>
        i > createdAt &&
        e.data?.type === 'updateBlock' &&
        JSON.stringify(e.data.patch).includes('rust async'),
    );
    expect(secondSearchStep).toBeGreaterThan(createdAt);
  });

  it('still emits an empty source block when nothing was found', async () => {
    const llm = new FakeLLM({ streamText: () => [call('c1', 'done', {})] });
    const session = createFakeSession();

    await research(llm, session);

    const sourceBlocks = [...session.blocks.values()].filter(
      (b) => b.type === 'source',
    );
    expect(sourceBlocks).toHaveLength(1);
    expect(sourceBlocks[0].data).toEqual([]);
  });
});
