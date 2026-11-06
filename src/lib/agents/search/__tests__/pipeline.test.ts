import { beforeAll, describe, expect, it, vi } from 'vitest';
import {
  FakeEmbedding,
  FakeLLM,
  createFakeSession,
} from '@/__tests__/helpers/fakes';
import { ClassifierOutput } from '../types';
import { StreamTextOutput } from '@/lib/models/types';

vi.mock('@/lib/searxng', () => ({
  searchSearxng: vi.fn(async (q: string) => ({
    results:
      q === 'rust web'
        ? [
            {
              title: 'Rust A',
              url: 'https://a.test/1',
              content: 'rust web memory',
            },
            {
              title: 'Rust B',
              url: 'https://b.test/2',
              content: 'rust web async',
            },
          ]
        : [
            {
              title: 'Rust A again',
              url: 'https://a.test/1',
              content: 'rust web tokio',
            },
          ],
    suggestions: [],
  })),
}));

import Researcher from '../researcher';
import APISearchAgent from '../api';
import SessionManager from '@/lib/session';

const classification = (
  overrides: Partial<ClassifierOutput['classification']> = {},
): ClassifierOutput => ({
  classification: {
    skipSearch: false,
    personalSearch: false,
    academicSearch: false,
    discussionSearch: false,
    showWeatherWidget: false,
    showStockWidget: false,
    showCalculationWidget: false,
    ...overrides,
  },
  standaloneFollowUp: 'Rust para web?',
});

const toolCall = (id: string, name: string, args: any): StreamTextOutput => ({
  contentChunk: '',
  toolCallChunk: [{ id, name, arguments: args }],
});

beforeAll(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-01-02T03:04:05.000Z'));
});

describe('Researcher', () => {
  it('runs tool calls per iteration, stops at done and merges sources by URL', async () => {
    const llm = new FakeLLM({
      streamText: (_input, i) =>
        i === 0
          ? [
              toolCall('c1', 'web_search', {
                queries: ['rust web', 'rust tokio'],
              }),
            ]
          : [toolCall('c2', 'done', {})],
    });
    const session = createFakeSession();

    const out = await new Researcher().research(session as any, {
      chatHistory: [],
      followUp: 'Rust para web?',
      classification: classification(),
      config: {
        sources: ['web'],
        fileIds: [],
        llm,
        embedding: new FakeEmbedding(),
        mode: 'speed',
        systemInstructions: '',
      },
    });

    expect(llm.calls.filter((c) => c.kind === 'streamText')).toHaveLength(2);

    // Second iteration sees the first tool call and its JSON result.
    const second = llm.calls[1].input.messages;
    expect(second.map((m) => m.role)).toEqual([
      'system',
      'user',
      'assistant',
      'tool',
    ]);
    expect(JSON.parse(second[3].content as string).type).toBe('search_results');

    // Results with the same URL are merged into one source.
    expect(out.searchFindings.map((f) => f.metadata.url)).toEqual([
      'https://a.test/1',
      'https://b.test/2',
    ]);
    expect(out.searchFindings[0].content).toBe(
      'rust web memory\n\nrust web tokio',
    );

    const blockTypes = session.events
      .filter((e) => e.data?.type === 'block')
      .map((e) => e.data.block.type);
    expect(blockTypes).toEqual(['research', 'source']);
  });

  it('stops after maxIteration (2 in speed) even without done', async () => {
    const llm = new FakeLLM({
      streamText: (_i, n) => [
        toolCall(`c${n}`, 'web_search', { queries: ['rust web'] }),
      ],
    });
    await new Researcher().research(createFakeSession() as any, {
      chatHistory: [],
      followUp: 'q',
      classification: classification(),
      config: {
        sources: ['web'],
        fileIds: [],
        llm,
        embedding: new FakeEmbedding(),
        mode: 'speed',
        systemInstructions: '',
      },
    });
    expect(llm.calls).toHaveLength(2);
  });

  it('offers the expected tools in each mode', async () => {
    const toolsFor = async (
      mode: 'speed' | 'balanced' | 'quality',
      sources: any[],
    ) => {
      const llm = new FakeLLM({ streamText: () => [] });
      await new Researcher().research(createFakeSession() as any, {
        chatHistory: [],
        followUp: 'q',
        classification: classification({
          academicSearch: true,
          discussionSearch: true,
        }),
        config: {
          sources,
          fileIds: [],
          llm,
          embedding: new FakeEmbedding(),
          mode,
          systemInstructions: '',
        },
      });
      return (llm.calls[0].input as any).tools.map((t: any) => t.name).sort();
    };
    expect(await toolsFor('speed', ['web'])).toEqual([
      'done',
      'scrape_url',
      'web_search',
    ]);
    expect(
      await toolsFor('balanced', ['web', 'academic', 'discussions']),
    ).toEqual([
      '__reasoning_preamble',
      'academic_search',
      'done',
      'scrape_url',
      'social_search',
      'web_search',
    ]);
  });
});

describe('APISearchAgent (writer context and stream)', () => {
  const run = async (skipSearch: boolean) => {
    const llm = new FakeLLM({
      generateObject: () => ({
        ...classification({ skipSearch }),
      }),
      streamText: (input, i) => {
        const isWriter = (input.messages[0].content as string).includes(
          'You are Vane',
        );
        if (isWriter) {
          return [
            { contentChunk: 'Rust é seguro', toolCallChunk: [] },
            { contentChunk: '[1].', toolCallChunk: [] },
          ];
        }
        return i === 0
          ? [toolCall('c1', 'web_search', { queries: ['rust web'] })]
          : [toolCall('c2', 'done', {})];
      },
    });

    const session = SessionManager.createSession();
    const events: any[] = [];
    session.subscribe((event, data) => events.push({ event, data }));

    await new APISearchAgent().searchAsync(session, {
      chatHistory: [
        { role: 'user', content: 'oi' },
        { role: 'assistant', content: 'olá' },
      ],
      followUp: 'Rust para web?',
      chatId: 'c',
      messageId: 'm',
      config: {
        sources: ['web'],
        fileIds: [],
        llm,
        embedding: new FakeEmbedding(),
        mode: 'speed',
        systemInstructions: 'Responda curto.',
      },
    });

    const writerCall = llm.calls.find(
      (c) =>
        c.kind === 'streamText' &&
        (c.input.messages[0].content as string).includes('You are Vane'),
    )!;
    return { llm, events, writerMessages: writerCall.input.messages };
  };

  it('puts numbered results in the system prompt and streams the answer', async () => {
    const { events, writerMessages } = await run(false);

    expect(writerMessages.map((m) => m.role)).toEqual([
      'system',
      'user',
      'assistant',
      'user',
    ]);
    expect(writerMessages[3].content).toBe('Rust para web?');
    expect(writerMessages[0].content).toMatchSnapshot();

    expect(events.map((e) => `${e.event}:${e.data.type ?? ''}`)).toEqual([
      'data:searchResults',
      'data:researchComplete',
      'data:response',
      'data:response',
      'end:',
    ]);
  });

  it('uses the no-search prompt when the classifier skips search', async () => {
    const { llm, writerMessages } = await run(true);
    expect(llm.calls.filter((c) => c.kind === 'streamText')).toHaveLength(1);
    expect(writerMessages[0].content).toMatchSnapshot();
  });
});
