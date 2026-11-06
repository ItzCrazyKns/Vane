import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  FakeEmbedding,
  FakeLLM,
  createFakeSession,
} from '@/__tests__/helpers/fakes';

vi.mock('@/lib/searxng', () => ({
  searchSearxng: vi.fn(),
}));

import { searchSearxng } from '@/lib/searxng';
import { executeSearch } from '../researcher/actions/search/baseSearch';
import {
  NO_NEW_QUERIES_NOTE,
  normalizeQueries,
} from '../researcher/actions/search/queries';
import Researcher from '../researcher';

const block = (searched: string[][] = []) => ({
  id: 'research',
  type: 'research' as const,
  data: {
    subSteps: searched.map((s) => ({
      id: crypto.randomUUID(),
      type: 'searching',
      searching: s,
    })) as any[],
  },
});

const hit = (url: string, content: string) => ({
  title: url,
  url,
  content,
});

describe('normalizeQueries', () => {
  it('accepts a string or array and drops junk', () => {
    expect(normalizeQueries('rust web')).toEqual(['rust web']);
    expect(normalizeQueries(undefined)).toEqual([]);
    expect(
      normalizeQueries(['  rust ', '', 'undefined', 'null', 42, null, 'go']),
    ).toEqual(['rust', 'go']);
  });

  it('dedupes ignoring case and spacing, and caps at three', () => {
    expect(
      normalizeQueries(['Rust  Web', 'rust web', 'a', 'b', 'c', 'd']),
    ).toEqual(['Rust  Web', 'a', 'b']);
  });

  it('skips queries already searched in this research', () => {
    expect(
      normalizeQueries(
        ['rust web', 'rust tokio'],
        block([['Rust Web']]) as any,
      ),
    ).toEqual(['rust tokio']);
  });
});

describe('executeSearch failure tolerance', () => {
  beforeEach(() => {
    vi.mocked(searchSearxng).mockReset();
  });

  it('keeps the results of the queries that worked (speed)', async () => {
    vi.mocked(searchSearxng).mockImplementation(async (q: string) => {
      if (q === 'broken') throw new Error('SearXNG error: Bad Request');
      return {
        results: [hit('https://a.test/1', 'rust web memory')],
        suggestions: [],
      };
    });

    const results = await executeSearch({
      queries: ['rust web', 'broken'],
      mode: 'speed',
      researchBlock: block() as any,
      session: createFakeSession() as any,
      llm: new FakeLLM({}),
      embedding: new FakeEmbedding(),
    });

    expect(results.map((r) => r.metadata.url)).toEqual(['https://a.test/1']);
  });

  it('returns nothing without calling the LLM when every query fails (quality)', async () => {
    vi.mocked(searchSearxng).mockImplementation(async () => {
      throw new Error('down');
    });
    const llm = new FakeLLM({});

    const results = await executeSearch({
      queries: ['a', 'b'],
      mode: 'quality',
      researchBlock: block() as any,
      session: createFakeSession() as any,
      llm,
      embedding: new FakeEmbedding(),
    });
    expect(results).toEqual([]);
    expect(llm.calls).toHaveLength(0);
  });

  it('shows the user question to the quality picker', async () => {
    vi.mocked(searchSearxng).mockResolvedValue({
      results: [hit('https://a.test/1', 'x')],
      suggestions: [],
    });
    const llm = new FakeLLM({ generateObject: () => ({ picked_indices: [] }) });

    await executeSearch({
      queries: ['rust web'],
      mode: 'quality',
      researchBlock: block() as any,
      session: createFakeSession() as any,
      llm,
      embedding: new FakeEmbedding(),
      question: 'Is Rust good for web backends?',
    });

    const user = llm.calls[0].input.messages[1].content as string;
    expect(user).toContain(
      '<question>Is Rust good for web backends?</question>',
    );
    expect(user).toContain('<queries>rust web</queries>');
  });
});

describe('Researcher robustness', () => {
  beforeEach(() => {
    vi.mocked(searchSearxng).mockReset();
  });

  const research = (llm: FakeLLM, mode: 'speed' | 'quality' = 'speed') =>
    new Researcher().research(createFakeSession() as any, {
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
        mode,
        systemInstructions: '',
      },
    });

  const call = (id: string, name: string, args: any) => ({
    contentChunk: '',
    toolCallChunk: [{ id, name, arguments: args }],
  });

  it('runs a search sent together with done before stopping', async () => {
    vi.mocked(searchSearxng).mockResolvedValue({
      results: [hit('https://a.test/1', 'rust web memory')],
      suggestions: [],
    });
    const llm = new FakeLLM({
      streamText: () => [
        call('c1', 'web_search', { queries: ['rust web'] }),
        call('c2', 'done', {}),
      ],
    });

    const out = await research(llm);

    expect(llm.calls.filter((c) => c.kind === 'streamText')).toHaveLength(1);
    expect(searchSearxng).toHaveBeenCalledTimes(1);
    expect(out.searchFindings.map((f) => f.metadata.url)).toEqual([
      'https://a.test/1',
    ]);
  });

  it('does not search for "undefined" and tells the model why', async () => {
    const llm = new FakeLLM({
      streamText: (_input, i) =>
        i === 0 ? [call('c1', 'web_search', {})] : [call('c2', 'done', {})],
    });

    await research(llm);

    expect(searchSearxng).not.toHaveBeenCalled();
    const toolMsg = llm.calls[1].input.messages.find((m) => m.role === 'tool');
    expect(JSON.parse(toolMsg!.content as string)).toMatchObject({
      type: 'search_results',
      results: [],
      note: NO_NEW_QUERIES_NOTE,
    });
  });
});
