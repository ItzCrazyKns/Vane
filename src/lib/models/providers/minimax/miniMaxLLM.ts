import OpenAILLM from '../openai/openaiLLM';
import {
  GenerateObjectInput,
  GenerateOptions,
  GenerateTextInput,
  GenerateTextOutput,
  StreamTextOutput,
} from '../../types';
import z from 'zod';
import { parse } from 'partial-json';
import { repairJson } from '@toolsycc/json-repair';

class MiniMaxLLM extends OpenAILLM {
  async generateText(input: GenerateTextInput): Promise<GenerateTextOutput> {
    const clampedInput = {
      ...input,
      options: this.clampTemperature(input.options),
    };
    return super.generateText(clampedInput);
  }

  async *streamText(
    input: GenerateTextInput,
  ): AsyncGenerator<StreamTextOutput> {
    const clampedInput = {
      ...input,
      options: this.clampTemperature(input.options),
    };
    yield* super.streamText(clampedInput);
  }

  async generateObject<T>(input: GenerateObjectInput): Promise<T> {
    const jsonSchema = z.toJSONSchema(input.schema);
    const jsonPrompt = `You must respond with valid JSON only, no other text. The JSON must conform to this schema:\n${JSON.stringify(jsonSchema, null, 2)}`;

    const systemMessage = { role: 'system' as const, content: jsonPrompt };
    const messages = [systemMessage, ...input.messages];

    const response = await this.openAIClient.chat.completions.create({
      model: this.config.model,
      messages: this.convertToOpenAIMessages(messages),
      temperature:
        this.clampTemperature(input.options)?.temperature ??
        this.clampTemperature(this.config.options)?.temperature ??
        1.0,
      top_p: input.options?.topP ?? this.config.options?.topP,
      max_completion_tokens:
        input.options?.maxTokens ?? this.config.options?.maxTokens,
      stop: input.options?.stopSequences ?? this.config.options?.stopSequences,
      frequency_penalty:
        input.options?.frequencyPenalty ??
        this.config.options?.frequencyPenalty,
      presence_penalty:
        input.options?.presencePenalty ?? this.config.options?.presencePenalty,
    });

    if (response.choices && response.choices.length > 0) {
      try {
        return input.schema.parse(
          JSON.parse(
            repairJson(response.choices[0].message.content!, {
              extractJson: true,
            }) as string,
          ),
        ) as T;
      } catch (err) {
        throw new Error(`Error parsing response from MiniMax: ${err}`);
      }
    }

    throw new Error('No response from MiniMax');
  }

  async *streamObject<T>(input: GenerateObjectInput): AsyncGenerator<T> {
    const jsonSchema = z.toJSONSchema(input.schema);
    const jsonPrompt = `You must respond with valid JSON only, no other text. The JSON must conform to this schema:\n${JSON.stringify(jsonSchema, null, 2)}`;

    const systemMessage = { role: 'system' as const, content: jsonPrompt };
    const messages = [systemMessage, ...input.messages];

    let receivedObj = '';

    const stream = await this.openAIClient.chat.completions.create({
      model: this.config.model,
      messages: this.convertToOpenAIMessages(messages),
      temperature:
        this.clampTemperature(input.options)?.temperature ??
        this.clampTemperature(this.config.options)?.temperature ??
        1.0,
      top_p: input.options?.topP ?? this.config.options?.topP,
      max_completion_tokens:
        input.options?.maxTokens ?? this.config.options?.maxTokens,
      stop: input.options?.stopSequences ?? this.config.options?.stopSequences,
      frequency_penalty:
        input.options?.frequencyPenalty ??
        this.config.options?.frequencyPenalty,
      presence_penalty:
        input.options?.presencePenalty ?? this.config.options?.presencePenalty,
      stream: true,
    });

    for await (const chunk of stream) {
      if (chunk.choices && chunk.choices.length > 0) {
        const content = chunk.choices[0].delta.content || '';
        receivedObj += content;

        try {
          yield parse(receivedObj) as T;
        } catch {
          yield {} as T;
        }
      }
    }
  }

  private clampTemperature(
    options?: GenerateOptions,
  ): GenerateOptions | undefined {
    if (!options) return options;
    if (
      options.temperature !== undefined &&
      options.temperature !== null &&
      options.temperature <= 0
    ) {
      return { ...options, temperature: 0.01 };
    }
    return options;
  }
}

export default MiniMaxLLM;
