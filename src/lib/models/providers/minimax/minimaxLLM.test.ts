import { describe, it, expect, vi, beforeEach } from 'vitest';
import MiniMaxLLM from './minimaxLLM';
import { StreamTextOutput } from '../../types';

const createMockMiniMaxLLM = () => {
  const instance = Object.create(MiniMaxLLM.prototype);
  instance.config = {
    apiKey: 'test-api-key',
    model: 'MiniMax-M2.5',
    baseURL: 'https://api.minimax.io/v1',
  };
  return instance;
};

async function* mockStreamGenerator(
  chunks: Partial<StreamTextOutput>[],
): AsyncGenerator<StreamTextOutput> {
  for (const chunk of chunks) {
    yield {
      contentChunk: chunk.contentChunk ?? '',
      toolCallChunk: chunk.toolCallChunk ?? [],
      done: chunk.done ?? false,
      additionalInfo: chunk.additionalInfo ?? {},
    };
  }
}

async function collectStreamOutput(
  generator: AsyncGenerator<StreamTextOutput>,
): Promise<string> {
  let result = '';
  for await (const chunk of generator) {
    result += chunk.contentChunk;
  }
  return result;
}

async function collectAllChunks(
  generator: AsyncGenerator<StreamTextOutput>,
): Promise<StreamTextOutput[]> {
  const chunks: StreamTextOutput[] = [];
  for await (const chunk of generator) {
    chunks.push(chunk);
  }
  return chunks;
}

describe('MiniMaxLLM', () => {
  describe('stripThinkingTags (private method via generateObject)', () => {
    it('should strip single think tag', () => {
      const llm = createMockMiniMaxLLM();
      const stripThinkingTags = llm['stripThinkingTags'].bind(llm);

      const input = '<think>some thinking</think>actual content';
      const result = stripThinkingTags(input);
      expect(result).toBe('actual content');
    });

    it('should strip multiple think tags', () => {
      const llm = createMockMiniMaxLLM();
      const stripThinkingTags = llm['stripThinkingTags'].bind(llm);

      const input =
        '<think>first</think>content1<think>second</think>content2';
      const result = stripThinkingTags(input);
      expect(result).toBe('content1content2');
    });

    it('should handle multiline think content', () => {
      const llm = createMockMiniMaxLLM();
      const stripThinkingTags = llm['stripThinkingTags'].bind(llm);

      const input = `<think>
        line1
        line2
      </think>actual content`;
      const result = stripThinkingTags(input);
      expect(result).toBe('actual content');
    });

    it('should return content unchanged when no think tags', () => {
      const llm = createMockMiniMaxLLM();
      const stripThinkingTags = llm['stripThinkingTags'].bind(llm);

      const input = 'just regular content';
      const result = stripThinkingTags(input);
      expect(result).toBe('just regular content');
    });

    it('should handle empty content after stripping', () => {
      const llm = createMockMiniMaxLLM();
      const stripThinkingTags = llm['stripThinkingTags'].bind(llm);

      const input = '<think>only thinking</think>';
      const result = stripThinkingTags(input);
      expect(result).toBe('');
    });
  });

  describe('streamText - think tag stripping', () => {
    it('should strip think tags in single chunk', async () => {
      const llm = createMockMiniMaxLLM();
      const mockChunks: Partial<StreamTextOutput>[] = [
        { contentChunk: '<think>thinking</think>actual content', done: true },
      ];

      const originalStreamText = vi.fn().mockReturnValue(mockStreamGenerator(mockChunks));
      Object.getPrototypeOf(Object.getPrototypeOf(llm)).streamText = originalStreamText;

      const result = await collectStreamOutput(
        llm.streamText({ messages: [] }),
      );
      expect(result).toBe('actual content');
    });

    it('should handle think tag split across two chunks', async () => {
      const llm = createMockMiniMaxLLM();
      const mockChunks: Partial<StreamTextOutput>[] = [
        { contentChunk: 'Hello <thi' },
        { contentChunk: 'nk>thinking</think> World', done: true },
      ];

      const originalStreamText = vi.fn().mockReturnValue(mockStreamGenerator(mockChunks));
      Object.getPrototypeOf(Object.getPrototypeOf(llm)).streamText = originalStreamText;

      const result = await collectStreamOutput(
        llm.streamText({ messages: [] }),
      );
      expect(result).toBe('Hello  World');
    });

    it('should handle closing tag split across chunks', async () => {
      const llm = createMockMiniMaxLLM();
      const mockChunks: Partial<StreamTextOutput>[] = [
        { contentChunk: '<think>thinking</th' },
        { contentChunk: 'ink>content', done: true },
      ];

      const originalStreamText = vi.fn().mockReturnValue(mockStreamGenerator(mockChunks));
      Object.getPrototypeOf(Object.getPrototypeOf(llm)).streamText = originalStreamText;

      const result = await collectStreamOutput(
        llm.streamText({ messages: [] }),
      );
      expect(result).toBe('content');
    });

    it('should handle multiple think tags across chunks', async () => {
      const llm = createMockMiniMaxLLM();
      const mockChunks: Partial<StreamTextOutput>[] = [
        { contentChunk: 'start<think>t1</think>mid' },
        { contentChunk: 'dle<think>t2</think>end', done: true },
      ];

      const originalStreamText = vi.fn().mockReturnValue(mockStreamGenerator(mockChunks));
      Object.getPrototypeOf(Object.getPrototypeOf(llm)).streamText = originalStreamText;

      const result = await collectStreamOutput(
        llm.streamText({ messages: [] }),
      );
      expect(result).toBe('startmiddleend');
    });

    it('should flush buffer on stream end', async () => {
      const llm = createMockMiniMaxLLM();
      const mockChunks: Partial<StreamTextOutput>[] = [
        { contentChunk: 'Hello' },
        { contentChunk: ' World', done: true },
      ];

      const originalStreamText = vi.fn().mockReturnValue(mockStreamGenerator(mockChunks));
      Object.getPrototypeOf(Object.getPrototypeOf(llm)).streamText = originalStreamText;

      const result = await collectStreamOutput(
        llm.streamText({ messages: [] }),
      );
      expect(result).toBe('Hello World');
    });

    it('should not lose trailing content on stream end', async () => {
      const llm = createMockMiniMaxLLM();
      const mockChunks: Partial<StreamTextOutput>[] = [
        { contentChunk: 'content<' },
        { contentChunk: 'thin', done: true },
      ];

      const originalStreamText = vi.fn().mockReturnValue(mockStreamGenerator(mockChunks));
      Object.getPrototypeOf(Object.getPrototypeOf(llm)).streamText = originalStreamText;

      const result = await collectStreamOutput(
        llm.streamText({ messages: [] }),
      );
      expect(result).toBe('content<thin');
    });

    it('should discard incomplete think tag content at stream end', async () => {
      const llm = createMockMiniMaxLLM();
      const mockChunks: Partial<StreamTextOutput>[] = [
        { contentChunk: 'content<think>incomplete' },
        { contentChunk: ' thinking', done: true },
      ];

      const originalStreamText = vi.fn().mockReturnValue(mockStreamGenerator(mockChunks));
      Object.getPrototypeOf(Object.getPrototypeOf(llm)).streamText = originalStreamText;

      const result = await collectStreamOutput(
        llm.streamText({ messages: [] }),
      );
      expect(result).toBe('content');
    });
  });

  describe('streamText - toolCallChunk preservation', () => {
    it('should preserve toolCallChunk when no visible text output', async () => {
      const llm = createMockMiniMaxLLM();
      const toolCallData = [{ name: 'test_tool', id: '1', arguments: {} }];
      const mockChunks: Partial<StreamTextOutput>[] = [
        { contentChunk: '<think>thinking</think>', toolCallChunk: toolCallData },
        { contentChunk: '', done: true },
      ];

      const originalStreamText = vi.fn().mockReturnValue(mockStreamGenerator(mockChunks));
      Object.getPrototypeOf(Object.getPrototypeOf(llm)).streamText = originalStreamText;

      const chunks = await collectAllChunks(llm.streamText({ messages: [] }));

      const chunksWithToolCalls = chunks.filter(
        (c) => c.toolCallChunk && c.toolCallChunk.length > 0,
      );
      expect(chunksWithToolCalls.length).toBeGreaterThan(0);
      expect(chunksWithToolCalls[0].toolCallChunk).toEqual(toolCallData);
    });

    it('should yield chunk when only toolCallChunk is present', async () => {
      const llm = createMockMiniMaxLLM();
      const toolCallData = [{ name: 'search', id: '123', arguments: { query: 'test' } }];
      const mockChunks: Partial<StreamTextOutput>[] = [
        { contentChunk: '', toolCallChunk: toolCallData },
        { contentChunk: '', done: true },
      ];

      const originalStreamText = vi.fn().mockReturnValue(mockStreamGenerator(mockChunks));
      Object.getPrototypeOf(Object.getPrototypeOf(llm)).streamText = originalStreamText;

      const chunks = await collectAllChunks(llm.streamText({ messages: [] }));

      expect(chunks.length).toBe(2);
      expect(chunks[0].toolCallChunk).toEqual(toolCallData);
    });
  });

  describe('streamText - edge cases', () => {
    it('should handle empty stream', async () => {
      const llm = createMockMiniMaxLLM();
      const mockChunks: Partial<StreamTextOutput>[] = [{ contentChunk: '', done: true }];

      const originalStreamText = vi.fn().mockReturnValue(mockStreamGenerator(mockChunks));
      Object.getPrototypeOf(Object.getPrototypeOf(llm)).streamText = originalStreamText;

      const result = await collectStreamOutput(
        llm.streamText({ messages: [] }),
      );
      expect(result).toBe('');
    });

    it('should handle content that looks like but is not a think tag', async () => {
      const llm = createMockMiniMaxLLM();
      const mockChunks: Partial<StreamTextOutput>[] = [
        { contentChunk: 'use <thinking> for analysis', done: true },
      ];

      const originalStreamText = vi.fn().mockReturnValue(mockStreamGenerator(mockChunks));
      Object.getPrototypeOf(Object.getPrototypeOf(llm)).streamText = originalStreamText;

      const result = await collectStreamOutput(
        llm.streamText({ messages: [] }),
      );
      expect(result).toBe('use <thinking> for analysis');
    });

    it('should preserve additionalInfo from chunks', async () => {
      const llm = createMockMiniMaxLLM();
      const mockChunks: Partial<StreamTextOutput>[] = [
        {
          contentChunk: 'content',
          done: true,
          additionalInfo: { finishReason: 'stop' },
        },
      ];

      const originalStreamText = vi.fn().mockReturnValue(mockStreamGenerator(mockChunks));
      Object.getPrototypeOf(Object.getPrototypeOf(llm)).streamText = originalStreamText;

      const chunks = await collectAllChunks(llm.streamText({ messages: [] }));

      expect(chunks[chunks.length - 1].additionalInfo).toEqual({
        finishReason: 'stop',
      });
    });

    it('should correctly signal done state', async () => {
      const llm = createMockMiniMaxLLM();
      const mockChunks: Partial<StreamTextOutput>[] = [
        { contentChunk: 'part1' },
        { contentChunk: 'part2' },
        { contentChunk: 'part3', done: true },
      ];

      const originalStreamText = vi.fn().mockReturnValue(mockStreamGenerator(mockChunks));
      Object.getPrototypeOf(Object.getPrototypeOf(llm)).streamText = originalStreamText;

      const chunks = await collectAllChunks(llm.streamText({ messages: [] }));

      const doneChunks = chunks.filter((c) => c.done);
      expect(doneChunks.length).toBe(1);
      expect(chunks[chunks.length - 1].done).toBe(true);
    });
  });
});
