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

const llmHolder = vi.hoisted(() => ({ llm: null as any }));

vi.mock('@/lib/models/registry', () => ({
  default: class {
    async loadChatModel() {
      return llmHolder.llm;
    }
    async loadEmbeddingModel() {
      return {};
    }
  },
}));

import SearchAgent from '../index';
import APISearchAgent from '../api';
import { POST as searchRoute } from '@/app/api/search/route';

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

const withTimeout = <T>(p: Promise<T>, ms = 2000): Promise<T> =>
  Promise.race([
    p,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`timed out after ${ms}ms`)), ms),
    ),
  ]);

describe('APISearchAgent failure', () => {
  it('emits an error event instead of rejecting', async () => {
    const llm = new FakeLLM({
      generateObject: () => {
        throw new Error('classifier exploded');
      },
    });
    const session = createFakeSession();

    await expect(
      new APISearchAgent().searchAsync(session as any, input(llm)),
    ).resolves.toBeUndefined();

    expect(session.events.at(-1)).toEqual({
      event: 'error',
      data: { data: 'classifier exploded' },
    });
  });
});

describe('POST /api/search on agent failure', () => {
  const request = (stream: boolean) =>
    new Request('http://localhost/api/search', {
      method: 'POST',
      body: JSON.stringify({
        sources: ['web'],
        query: 'q',
        stream,
        chatModel: { providerId: 'p', key: 'k' },
        embeddingModel: { providerId: 'p', key: 'e' },
      }),
    });

  beforeEach(() => {
    llmHolder.llm = new FakeLLM({
      generateObject: () => {
        throw new Error('classifier exploded');
      },
    });
  });

  it('returns a 500 JSON with a message (non-stream), without hanging', async () => {
    const res = await withTimeout(searchRoute(request(false)));

    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.message).toEqual(expect.any(String));
    expect(body.error).toBe('classifier exploded');
  });

  it('sends an error event and closes the stream, without hanging', async () => {
    const res = await withTimeout(searchRoute(request(true)));
    const text = await withTimeout(res.text());
    const lines = text
      .trim()
      .split('\n')
      .map((l) => JSON.parse(l));

    expect(lines[0].type).toBe('init');
    expect(lines.at(-1)).toEqual({
      type: 'error',
      data: 'classifier exploded',
    });
  });

  it('keeps the success shape unchanged', async () => {
    llmHolder.llm = new FakeLLM({
      generateObject: () => classification(true),
      streamText: () => [{ contentChunk: 'hi', toolCallChunk: [] }],
    });

    const res = await withTimeout(searchRoute(request(false)));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ message: 'hi', sources: [] });
  });
});
