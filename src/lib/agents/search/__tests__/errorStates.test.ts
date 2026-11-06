import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  FakeEmbedding,
  FakeLLM,
  createFakeSession,
} from '@/__tests__/helpers/fakes';
import { StreamTextOutput } from '@/lib/models/types';

/* In-memory stand-in for the drizzle db: records every update so the
   tests can check what status and blocks end up in the messages row. */
const dbState = vi.hoisted(() => ({
  updates: [] as Record<string, any>[],
}));

vi.mock('@/lib/db', () => {
  const chain = (onSet?: (v: any) => void) => ({
    set: (v: any) => {
      onSet?.(v);
      return chain();
    },
    values: async () => undefined,
    where: () => chain(),
    execute: async () => undefined,
  });
  return {
    default: {
      query: { messages: { findFirst: async () => undefined } },
      insert: () => chain(),
      update: () => chain((v) => dbState.updates.push(v)),
      delete: () => chain(),
    },
  };
});

vi.mock('@/lib/searxng', () => ({
  searchSearxng: vi.fn(async () => ({ results: [], suggestions: [] })),
}));

import SearchAgent from '../index';

const classification = (skipSearch: boolean) => ({
  classification: {
    skipSearch,
    personalSearch: false,
    academicSearch: false,
    discussionSearch: false,
    showWeatherWidget: false,
    showStockWidget: false,
    showCalculationWidget: false,
  },
  standaloneFollowUp: 'q',
});

/* A writer stream that yields some text and then fails mid-answer. */
const failingAfter = (text: string): StreamTextOutput[] =>
  (function* () {
    yield { contentChunk: text, toolCallChunk: [] };
    throw new Error('writer exploded');
  })() as unknown as StreamTextOutput[];

const input = (llm: FakeLLM) => ({
  chatHistory: [],
  followUp: 'q',
  chatId: 'chat-1',
  messageId: 'msg-1',
  config: {
    sources: ['web' as const],
    fileIds: [],
    llm,
    embedding: new FakeEmbedding(),
    mode: 'speed' as const,
    systemInstructions: '',
  },
});

const lastUpdate = () => dbState.updates[dbState.updates.length - 1];

beforeEach(() => {
  dbState.updates = [];
});

describe('SearchAgent failure persistence', () => {
  it('marks the message as error when the classifier throws', async () => {
    const llm = new FakeLLM({
      generateObject: () => {
        throw new Error('classifier exploded');
      },
    });
    const session = createFakeSession();

    await new SearchAgent().searchAsync(session as any, input(llm));

    expect(session.events.at(-1)).toEqual({
      event: 'error',
      data: { data: 'classifier exploded' },
    });
    expect(lastUpdate().status).toBe('error');
    expect(lastUpdate().responseBlocks).toEqual([]);
  });

  it('marks the message as error when the researcher throws', async () => {
    const llm = new FakeLLM({
      generateObject: () => classification(false),
      streamText: () => {
        throw new Error('researcher exploded');
      },
    });
    const session = createFakeSession();

    await new SearchAgent().searchAsync(session as any, input(llm));

    expect(session.events.at(-1)?.event).toBe('error');
    expect(lastUpdate().status).toBe('error');
  });

  it('keeps the partial answer when the writer throws mid-stream', async () => {
    const llm = new FakeLLM({
      generateObject: () => classification(true),
      streamText: () => failingAfter('partial answer'),
    });
    const session = createFakeSession();

    await new SearchAgent().searchAsync(session as any, input(llm));

    expect(session.events.at(-1)?.event).toBe('error');
    expect(lastUpdate().status).toBe('error');
    expect(lastUpdate().responseBlocks).toEqual([
      expect.objectContaining({ type: 'text', data: 'partial answer' }),
    ]);
  });

  it('still saves completed on success', async () => {
    const llm = new FakeLLM({
      generateObject: () => classification(true),
      streamText: () => [{ contentChunk: 'ok', toolCallChunk: [] }],
    });
    const session = createFakeSession();

    await new SearchAgent().searchAsync(session as any, input(llm));

    expect(lastUpdate().status).toBe('completed');
  });
});
