import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_CONTEXT_WINDOW,
  computeBudget,
  estimateMessagesTokens,
  estimateTokens,
  getContextWindow,
} from '../budget';
import {
  compactResearchHistory,
  fitSourcesToBudget,
  stubForToolResult,
} from '../compact';
import type { Chunk, Message, ToolMessage } from '@/lib/types';

const words = (n: number) =>
  Array.from({ length: n }, (_, i) => `w${i}`).join(' ');

const searchResult = (id: string, n: number): ToolMessage => ({
  role: 'tool',
  id,
  name: 'web_search',
  content: JSON.stringify({
    type: 'search_results',
    results: [
      {
        content: words(n),
        metadata: { title: `Title ${id}`, url: `https://x.test/${id}` },
      },
    ],
  }),
});

const toolTurn = (id: string, n: number): Message[] => [
  {
    role: 'assistant',
    content: '',
    tool_calls: [{ id, name: 'web_search', arguments: { queries: [id] } }],
  },
  searchResult(id, n),
];

const history = (sizes: number[]): Message[] => [
  { role: 'user', content: 'question' },
  ...sizes.flatMap((n, i) => toolTurn(`t${i}`, n)),
];

describe('getContextWindow', () => {
  afterEach(() => {
    delete process.env.LLM_CONTEXT_WINDOW;
  });

  it('prefers LLM_CONTEXT_WINDOW over the provider', async () => {
    process.env.LLM_CONTEXT_WINDOW = '16000';
    const llm = { getContextWindow: vi.fn(async () => 128000) };
    expect(await getContextWindow(llm)).toBe(16000);
  });

  it('uses what the provider reports', async () => {
    expect(await getContextWindow({ getContextWindow: async () => 8192 })).toBe(
      8192,
    );
  });

  it('falls back to the default when unknown or failing', async () => {
    expect(
      await getContextWindow({ getContextWindow: async () => undefined }),
    ).toBe(DEFAULT_CONTEXT_WINDOW);
    expect(
      await getContextWindow({
        getContextWindow: async () => {
          throw new Error('down');
        },
      }),
    ).toBe(DEFAULT_CONTEXT_WINDOW);
  });
});

describe('budget', () => {
  it('reserves output and margin', () => {
    expect(computeBudget(32000, 6000)).toBe(22800);
    expect(computeBudget(4000, 6000)).toBe(0);
  });

  it('counts tool calls and per-message overhead', () => {
    const plain = estimateMessagesTokens([{ role: 'user', content: 'hi' }]);
    const withCall = estimateMessagesTokens(toolTurn('a', 0).slice(0, 1));
    expect(plain).toBeGreaterThan(estimateTokens('hi'));
    expect(withCall).toBeGreaterThan(4);
  });
});

describe('compactResearchHistory', () => {
  it('leaves a small history alone', () => {
    const h = history([50, 50]);
    const { history: out, report } = compactResearchHistory(h, 100000);
    expect(out).toBe(h);
    expect(report.cleared).toBe(0);
  });

  it('clears all but the last two tool results above 75%', () => {
    const h = history([400, 400, 400, 400]);
    const total = estimateMessagesTokens(h);
    /* total sits between 75% and 100% of this budget */
    const { history: out, report } = compactResearchHistory(h, total / 0.8);

    const tools = out.filter((m) => m.role === 'tool') as ToolMessage[];
    expect(report.cleared).toBe(2);
    expect(tools[0].content).toContain('removed to save context');
    expect(tools[0].content).toContain('https://x.test/t0');
    expect(tools[2].content).toBe((h[6] as ToolMessage).content);
    expect(tools[3].content).toBe((h[8] as ToolMessage).content);
    expect(report.after).toBeLessThan(report.before);
    /* input untouched; every tool call still has its answer */
    expect((h[2] as ToolMessage).content).not.toContain('removed');
    expect(out).toHaveLength(h.length);
  });

  it('clears recent results and finally truncates to fit the budget', () => {
    const h = history([300, 300, 3000]);
    const budget = 1500;
    const { history: out, report } = compactResearchHistory(h, budget, 100);
    expect(report.after).toBeLessThanOrEqual(budget);
    expect(report.truncated + report.cleared).toBeGreaterThan(0);
    expect(out).toHaveLength(h.length);
  });

  it('stubs non-JSON results without throwing', () => {
    expect(
      stubForToolResult({ role: 'tool', id: '1', name: 'x', content: 'oops' }),
    ).toContain('removed to save context');
  });
});

describe('fitSourcesToBudget', () => {
  const fmt = (s: Chunk, i: number) =>
    `<result index=${i + 1} title=${s.metadata.title}>${s.content}</result>`;
  const src = (n: number, i: number): Chunk => ({
    content: words(n),
    metadata: { title: `S${i}`, url: `https://s.test/${i}` },
  });
  const cost = (list: Chunk[]) =>
    list.reduce((t, s, i) => t + estimateTokens(fmt(s, i)), 0);

  it('keeps everything that fits', () => {
    const sources = [src(50, 0), src(50, 1)];
    const out = fitSourcesToBudget(sources, 10000, fmt);
    expect(out.sources).toBe(sources);
  });

  it('keeps order, leaves short sources whole and cuts long ones', () => {
    const sources = [src(40, 0), src(3000, 1), src(40, 2), src(3000, 3)];
    const budget = 2400;
    const out = fitSourcesToBudget(sources, budget, fmt);
    expect(out.sources.map((s) => s.metadata.title)).toEqual([
      'S0',
      'S1',
      'S2',
      'S3',
    ]);
    expect(out.sources[0].content).toBe(sources[0].content);
    expect(out.sources[2].content).toBe(sources[2].content);
    expect(out.truncated).toBe(2);
    expect(cost(out.sources)).toBeLessThanOrEqual(budget);
  });

  it('drops tail sources when the budget is tiny', () => {
    const sources = Array.from({ length: 10 }, (_, i) => src(500, i));
    const out = fitSourcesToBudget(sources, 900, fmt);
    expect(out.sources.length).toBe(3);
    expect(out.dropped).toBe(7);
    expect(out.sources[0].metadata.title).toBe('S0');
    expect(cost(out.sources)).toBeLessThanOrEqual(900);
  });
});
