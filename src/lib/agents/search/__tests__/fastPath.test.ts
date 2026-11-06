/* Suggestions 5 and 7 of the Perplexity comparison: declarative effort
   presets per mode, and a speed fast path that searches with the
   classifier's queries instead of asking the researcher LLM first. */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  FakeEmbedding,
  FakeLLM,
  createFakeSession,
} from '@/__tests__/helpers/fakes';

const searxngMock = vi.fn();
vi.mock('@/lib/searxng', () => ({
  searchSearxng: (q: string, o: any) => searxngMock(q, o),
}));
vi.mock('@/lib/scraper', () => ({
  default: { scrape: vi.fn(async () => ({ title: 't', content: '' })) },
}));

import Researcher, { fastPathQueries } from '../researcher';
import { EFFORT_PRESETS, getEffort } from '../effort';
import { classify } from '../classifier';

const classification = (over: Record<string, any> = {}, queries?: any) => ({
  classification: {
    skipSearch: false,
    personalSearch: false,
    academicSearch: false,
    discussionSearch: false,
    showWeatherWidget: false,
    showStockWidget: false,
    showCalculationWidget: false,
    ...over,
  },
  standaloneFollowUp: 'Is Rust good for web?',
  ...(queries !== undefined ? { searchQueries: queries } : {}),
});

const input = (
  mode: 'speed' | 'balanced' | 'quality',
  cls = classification({}, ['rust web']),
  extra: { followUp?: string; fileIds?: string[]; sources?: any[] } = {},
) =>
  ({
    chatHistory: [],
    followUp: extra.followUp ?? 'rust?',
    classification: cls,
    config: {
      sources: extra.sources ?? ['web'],
      fileIds: extra.fileIds ?? [],
      llm: new FakeLLM({}),
      embedding: new FakeEmbedding(),
      mode,
      systemInstructions: '',
    },
  }) as any;

describe('effort presets', () => {
  it('keeps the iteration budgets of each mode', () => {
    expect(EFFORT_PRESETS.speed.maxIterations).toBe(2);
    expect(EFFORT_PRESETS.balanced.maxIterations).toBe(6);
    expect(EFFORT_PRESETS.quality.maxIterations).toBe(25);
    expect(getEffort('balanced').readPages).toBe(2);
    expect(getEffort('speed').fastPath).toBe(true);
    expect(getEffort('unknown' as any)).toBe(EFFORT_PRESETS.speed);
  });
});

describe('fastPathQueries', () => {
  const tools = ['web_search', 'done'];

  it('uses up to three distinct classifier queries in speed mode', () => {
    const cls = classification({}, [
      ' rust web ',
      'Rust web',
      '',
      'rust async',
      'rust tokio',
      'rust axum',
    ]);
    expect(fastPathQueries(input('speed', cls), tools)).toEqual([
      'rust web',
      'rust async',
      'rust tokio',
    ]);
  });

  it('does not apply outside speed or without queries', () => {
    expect(fastPathQueries(input('balanced'), tools)).toBeUndefined();
    expect(fastPathQueries(input('quality'), tools)).toBeUndefined();
    expect(
      fastPathQueries(input('speed', classification({}, [])), tools),
    ).toBeUndefined();
    expect(
      fastPathQueries(input('speed', classification({})), tools),
    ).toBeUndefined();
  });

  it('leaves uploads, other sources, MCP tools and URLs to the researcher', () => {
    expect(
      fastPathQueries(input('speed', undefined, { fileIds: ['f1'] }), tools),
    ).toBeUndefined();
    expect(
      fastPathQueries(
        input('speed', classification({ academicSearch: true }, ['x'])),
        tools,
      ),
    ).toBeUndefined();
    expect(
      fastPathQueries(input('speed'), [...tools, 'mcp_lookup']),
    ).toBeUndefined();
    expect(fastPathQueries(input('speed'), ['done'])).toBeUndefined();
    expect(
      fastPathQueries(
        input('speed', undefined, { followUp: 'resuma https://a.test/x' }),
        tools,
      ),
    ).toBeUndefined();
  });
});

describe('Researcher speed fast path', () => {
  beforeEach(() => searxngMock.mockReset());

  const call = (id: string, name: string, args: any) => ({
    contentChunk: '',
    toolCallChunk: [{ id, name, arguments: args }],
  });

  it('searches with the classifier queries without calling the LLM', async () => {
    searxngMock.mockResolvedValue({
      results: [{ title: 'Rust', url: 'https://a.test/', content: 'rust web' }],
      suggestions: [],
    });
    const llm = new FakeLLM({ streamText: () => [call('c1', 'done', {})] });
    const i = input('speed');
    i.config.llm = llm;

    const out = await new Researcher().research(createFakeSession() as any, i);

    expect(llm.calls).toHaveLength(0);
    expect(searxngMock).toHaveBeenCalledWith('rust web', {});
    expect(out.searchFindings.map((c) => c.metadata.url)).toEqual([
      'https://a.test/',
    ]);
  });

  it('falls back to the researcher loop when the fast search finds nothing', async () => {
    searxngMock.mockResolvedValue({ results: [], suggestions: [] });
    const llm = new FakeLLM({ streamText: () => [call('c1', 'done', {})] });
    const i = input('speed');
    i.config.llm = llm;

    await new Researcher().research(createFakeSession() as any, i);

    // The loop runs: done with no sources gets one more try (no-evidence note).
    expect(llm.calls.filter((c) => c.kind === 'streamText').length).toBe(2);
  });
});

describe('classifier searchQueries', () => {
  const base = {
    classification: classification().classification,
    standaloneFollowUp: 'q',
  };

  it('accepts a response without the field', async () => {
    const llm = new FakeLLM({
      generateObject: (i: any) => i.schema.parse(base),
    });
    const out = await classify({
      llm,
      enabledSources: ['web'],
      query: 'q',
      chatHistory: [],
    });
    expect(out.searchQueries).toEqual([]);
  });

  it('keeps the queries the model sent', async () => {
    const llm = new FakeLLM({
      generateObject: (i: any) =>
        i.schema.parse({ ...base, searchQueries: ['a', 'b'] }),
    });
    const out = await classify({
      llm,
      enabledSources: ['web'],
      query: 'q',
      chatHistory: [],
    });
    expect(out.searchQueries).toEqual(['a', 'b']);
  });
});
