/* The writer may cite [n] above the number of sources it was given
   (upstream #1227); the saved answer must not keep those numbers. */
import { describe, expect, it, vi } from 'vitest';
import { FakeEmbedding, FakeLLM } from '@/__tests__/helpers/fakes';
import { StreamTextOutput } from '@/lib/models/types';

const { updates } = vi.hoisted(() => ({ updates: [] as any[] }));

vi.mock('@/lib/db', () => ({
  default: {
    query: { messages: { findFirst: async () => undefined } },
    insert: () => ({ values: async () => {} }),
    delete: () => ({ where: () => ({ execute: async () => {} }) }),
    update: () => ({
      set: (value: any) => {
        updates.push(value);
        return { where: () => ({ execute: async () => {} }) };
      },
    }),
  },
}));

vi.mock('@/lib/searxng', () => ({
  searchSearxng: vi.fn(async () => ({
    results: [
      { title: 'Rust A', url: 'https://a.test/1', content: 'rust web memory' },
      { title: 'Rust B', url: 'https://b.test/2', content: 'rust web async' },
    ],
    suggestions: [],
  })),
}));

import SearchAgent from '..';
import SessionManager from '@/lib/session';

const toolCall = (id: string, name: string, args: any): StreamTextOutput => ({
  contentChunk: '',
  toolCallChunk: [{ id, name, arguments: args }],
});

describe('SearchAgent citations', () => {
  it('drops citation numbers above the number of writer sources', async () => {
    const llm = new FakeLLM({
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
        standaloneFollowUp: 'Rust para web?',
      }),
      streamText: (input, i) => {
        if ((input.messages[0].content as string).includes('You are Vane')) {
          return [
            { contentChunk: 'Rust é seguro [1][7]', toolCallChunk: [] },
            { contentChunk: ' e rápido [2, 9].', toolCallChunk: [] },
          ];
        }
        return i === 0
          ? [toolCall('c1', 'web_search', { queries: ['rust web'] })]
          : [toolCall('c2', 'done', {})];
      },
    });

    const session = SessionManager.createSession();
    await new SearchAgent().searchAsync(session, {
      chatHistory: [],
      followUp: 'Rust para web?',
      chatId: 'c',
      messageId: 'm',
      config: {
        sources: ['web'],
        fileIds: [],
        llm,
        embedding: new FakeEmbedding(),
        mode: 'speed',
        systemInstructions: '',
      },
    });

    const sources = session
      .getAllBlocks()
      .filter((b) => b.type === 'source')
      .flatMap((b: any) => b.data);
    expect(sources).toHaveLength(2);

    const text = session.getAllBlocks().find((b) => b.type === 'text') as any;
    expect(text.data).toBe('Rust é seguro [1] e rápido [2].');

    const saved = updates
      .at(-1)
      .responseBlocks.find((b: any) => b.type === 'text');
    expect(saved.data).toBe('Rust é seguro [1] e rápido [2].');
  });
});
