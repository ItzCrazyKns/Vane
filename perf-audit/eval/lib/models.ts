/* Model setup for the eval. The chat model is wrapped so every call runs
   at temperature 0, whatever the caller asked for, and so the run can
   count calls and time them. Production code is not touched. */
import BaseLLM from '@/lib/models/base/llm';
import {
  GenerateObjectInput,
  GenerateTextInput,
  GenerateTextOutput,
  StreamTextOutput,
} from '@/lib/models/types';
import LMStudioLLM from '@/lib/models/providers/lmstudio/lmstudioLLM';
import LMStudioEmbedding from '@/lib/models/providers/lmstudio/lmstudioEmbedding';
import z from 'zod';

export type CallStat = { kind: string; ms: number };

const zeroTemp = <T extends { options?: any }>(input: T): T => ({
  ...input,
  options: { ...(input.options ?? {}), temperature: 0 },
});

export class TempZeroLLM extends BaseLLM<{ inner: BaseLLM<any> }> {
  stats: CallStat[] = [];

  constructor(private inner: BaseLLM<any>) {
    super({ inner });
  }

  async generateText(input: GenerateTextInput): Promise<GenerateTextOutput> {
    const t = performance.now();
    try {
      return await this.inner.generateText(zeroTemp(input));
    } finally {
      this.stats.push({ kind: 'generateText', ms: performance.now() - t });
    }
  }

  async *streamText(
    input: GenerateTextInput,
  ): AsyncGenerator<StreamTextOutput> {
    const t = performance.now();
    try {
      yield* this.inner.streamText(zeroTemp(input));
    } finally {
      this.stats.push({ kind: 'streamText', ms: performance.now() - t });
    }
  }

  async generateObject<T>(input: GenerateObjectInput): Promise<z.infer<T>> {
    const t = performance.now();
    try {
      return await this.inner.generateObject<T>(zeroTemp(input));
    } finally {
      this.stats.push({ kind: 'generateObject', ms: performance.now() - t });
    }
  }

  async *streamObject<T>(
    input: GenerateObjectInput,
  ): AsyncGenerator<Partial<z.infer<T>>> {
    const t = performance.now();
    try {
      yield* this.inner.streamObject<T>(zeroTemp(input));
    } finally {
      this.stats.push({ kind: 'streamObject', ms: performance.now() - t });
    }
  }
}

export type EvalModelEnv = {
  baseURL: string;
  chatModel: string;
  embeddingModel: string;
};

export const readModelEnv = (): EvalModelEnv => {
  const chatModel = process.env.EVAL_CHAT_MODEL;
  const embeddingModel = process.env.EVAL_EMBEDDING_MODEL;
  if (!chatModel || !embeddingModel) {
    throw new Error(
      'Set EVAL_CHAT_MODEL and EVAL_EMBEDDING_MODEL (LM Studio model keys).',
    );
  }
  return {
    baseURL: process.env.EVAL_BASE_URL || 'http://localhost:1234/v1',
    chatModel,
    embeddingModel,
  };
};

/* Same classes Vane uses for an LM Studio provider. */
export const createModels = (env: EvalModelEnv) => {
  const llm = new TempZeroLLM(
    new LMStudioLLM({
      apiKey: 'lm-studio',
      model: env.chatModel,
      baseURL: env.baseURL,
      options: { temperature: 0 },
    }),
  );
  const embedding = new LMStudioEmbedding({
    apiKey: 'lm-studio',
    model: env.embeddingModel,
    baseURL: env.baseURL,
  });
  return { llm, embedding };
};
