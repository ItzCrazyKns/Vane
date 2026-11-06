import z from 'zod';
import {
  GenerateObjectInput,
  GenerateOptions,
  GenerateTextInput,
  GenerateTextOutput,
  StreamTextOutput,
} from '../types';

abstract class BaseLLM<CONFIG> {
  constructor(protected config: CONFIG) {}
  abstract generateText(input: GenerateTextInput): Promise<GenerateTextOutput>;
  abstract streamText(
    input: GenerateTextInput,
  ): AsyncGenerator<StreamTextOutput>;
  abstract generateObject<T>(input: GenerateObjectInput): Promise<z.infer<T>>;
  abstract streamObject<T>(
    input: GenerateObjectInput,
  ): AsyncGenerator<Partial<z.infer<T>>>;

  /**
   * Size of the model's context window in tokens, when the provider can
   * tell. Providers that cannot return undefined and the caller falls back
   * to LLM_CONTEXT_WINDOW or a default (see lib/context/budget.ts).
   */
  async getContextWindow(): Promise<number | undefined> {
    return undefined;
  }
}

export default BaseLLM;
