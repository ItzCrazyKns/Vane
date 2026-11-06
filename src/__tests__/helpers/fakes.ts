/* Deterministic stand-ins for the LLM, the embedding model and the
   session, used by the characterization tests. They never call a network
   service, so the tests pin down Vane's own logic only. */
import BaseLLM from '@/lib/models/base/llm';
import BaseEmbedding from '@/lib/models/base/embedding';
import {
  GenerateObjectInput,
  GenerateTextInput,
  GenerateTextOutput,
  StreamTextOutput,
} from '@/lib/models/types';
import { Chunk } from '@/lib/types';

export type LLMCall = {
  kind: 'generateText' | 'streamText' | 'generateObject' | 'streamObject';
  input: GenerateTextInput | GenerateObjectInput;
};

type Handlers = {
  generateObject?: (input: GenerateObjectInput, callIndex: number) => any;
  streamText?: (
    input: GenerateTextInput,
    callIndex: number,
  ) => StreamTextOutput[];
};

export class FakeLLM extends BaseLLM<Handlers> {
  calls: LLMCall[] = [];

  constructor(handlers: Handlers) {
    super(handlers);
  }

  private count(kind: LLMCall['kind']) {
    return this.calls.filter((c) => c.kind === kind).length;
  }

  async generateText(input: GenerateTextInput): Promise<GenerateTextOutput> {
    this.calls.push({ kind: 'generateText', input });
    return { content: '', toolCalls: [] };
  }

  async *streamText(
    input: GenerateTextInput,
  ): AsyncGenerator<StreamTextOutput> {
    const index = this.count('streamText');
    this.calls.push({ kind: 'streamText', input });
    const chunks = this.config.streamText?.(input, index) ?? [];
    for (const chunk of chunks) yield chunk;
  }

  async generateObject<T>(input: GenerateObjectInput): Promise<T> {
    const index = this.count('generateObject');
    this.calls.push({ kind: 'generateObject', input });
    if (!this.config.generateObject) {
      throw new Error('FakeLLM: no generateObject handler');
    }
    return this.config.generateObject(input, index);
  }

  async *streamObject<T>(input: GenerateObjectInput): AsyncGenerator<T> {
    this.calls.push({ kind: 'streamObject', input });
  }
}

/* Maps each text to a small vector derived from its words, so that texts
   sharing words are similar and the similarity math is reproducible. */
export const VOCAB = [
  'rust',
  'go',
  'web',
  'concurrency',
  'memory',
  'async',
  'tokio',
  'goroutines',
];

export const embedDeterministic = (text: string): number[] => {
  const words = text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
  const known = VOCAB.map((v) => words.filter((w) => w === v).length);
  // Last dimension counts words outside the vocabulary.
  return [...known, words.filter((w) => !VOCAB.includes(w)).length];
};

export class FakeEmbedding extends BaseEmbedding<{}> {
  calls: string[][] = [];

  constructor() {
    super({});
  }

  async embedText(texts: string[]): Promise<number[][]> {
    this.calls.push(texts);
    return texts.map(embedDeterministic);
  }

  async embedChunks(chunks: Chunk[]): Promise<number[][]> {
    return this.embedText(chunks.map((c) => c.content));
  }
}

/* Minimal session that records what the pipeline sends to the UI. */
export const createFakeSession = () => {
  const blocks = new Map<string, any>();
  const events: { event: string; data: any }[] = [];
  return {
    id: 'fake-session',
    blocks,
    events,
    emit(event: string, data: any) {
      events.push({ event, data });
    },
    emitBlock(block: any) {
      blocks.set(block.id, block);
      events.push({ event: 'data', data: { type: 'block', block } });
    },
    getBlock(id: string) {
      return blocks.get(id);
    },
    updateBlock(id: string, patch: any[]) {
      events.push({
        event: 'data',
        data: { type: 'updateBlock', blockId: id, patch },
      });
    },
    getAllBlocks() {
      return Array.from(blocks.values());
    },
  };
};
