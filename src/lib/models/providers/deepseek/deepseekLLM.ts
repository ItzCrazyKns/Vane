import OpenAI from 'openai';
import BaseLLM from '../../base/llm';
import { zodTextFormat, zodResponseFormat } from 'openai/helpers/zod';
import {
  GenerateObjectInput,
  GenerateTextInput,
  GenerateTextOutput,
  StreamTextOutput,
  ToolCall,
} from '../../types';
import { parse } from 'partial-json';
import z from 'zod';
import {
  ChatCompletionAssistantMessageParam,
  ChatCompletionMessageParam,
  ChatCompletionTool,
  ChatCompletionToolMessageParam,
} from 'openai/resources/index.mjs';
import { Message } from '@/lib/types';
import { repairJson } from '@toolsycc/json-repair';

type DeepSeekConfig = {
  apiKey: string;
  model: string;
  baseURL?: string;
};

class DeepSeekLLM extends BaseLLM<DeepSeekConfig> {
  deepseekClient: OpenAI;

  constructor(protected config: DeepSeekConfig) {
    super(config);

    this.deepseekClient = new OpenAI({
      apiKey: this.config.apiKey,
      baseURL: this.config.baseURL || 'https://api.deepseek.com/v1',
    });
  }

  convertToDeepSeekMessages(messages: Message[]): ChatCompletionMessageParam[] {
    return messages.map((msg) => {
      if (msg.role === 'tool') {
        return {
          role: 'tool',
          tool_call_id: msg.id,
          content: msg.content,
        } as ChatCompletionToolMessageParam;
      } else if (msg.role === 'assistant') {
        return {
          role: 'assistant',
          content: msg.content,
          ...(msg.tool_calls &&
            msg.tool_calls.length > 0 && {
              tool_calls: msg.tool_calls?.map((tc) => ({
                id: tc.id,
                type: 'function',
                function: {
                  name: tc.name,
                  arguments: JSON.stringify(tc.arguments),
                },
              })),
            }),
        } as ChatCompletionAssistantMessageParam;
      }

      return msg;
    });
  }

  async generateText(input: GenerateTextInput): Promise<GenerateTextOutput> {
    const deepseekTools: ChatCompletionTool[] = [];

    input.tools?.forEach((tool) => {
      deepseekTools.push({
        type: 'function',
        function: {
          name: tool.name,
          description: tool.description,
          parameters: z.toJSONSchema(tool.schema),
        },
      });
    });

    const response = await this.deepseekClient.chat.completions.create({
      model: this.config.model,
      tools: deepseekTools.length > 0 ? deepseekTools : undefined,
      messages: this.convertToDeepSeekMessages(input.messages),
      temperature: input.options?.temperature ?? 1.0,
      top_p: input.options?.topP,
      max_completion_tokens: input.options?.maxTokens,
      stop: input.options?.stopSequences,
      frequency_penalty: input.options?.frequencyPenalty,
      presence_penalty: input.options?.presencePenalty,
    });

    if (response.choices && response.choices.length > 0) {
      return {
        content: response.choices[0].message.content!,
        toolCalls:
          response.choices[0].message.tool_calls
            ?.map((tc) => {
              if (tc.type === 'function') {
                return {
                  name: tc.function.name,
                  id: tc.id,
                  arguments: JSON.parse(tc.function.arguments),
                };
              }
            })
            .filter((tc) => tc !== undefined) || [],
        additionalInfo: {
          finishReason: response.choices[0].finish_reason,
        },
      };
    }

    throw new Error('No response from DeepSeek');
  }

  async *streamText(
    input: GenerateTextInput,
  ): AsyncGenerator<StreamTextOutput> {
    const deepseekTools: ChatCompletionTool[] = [];

    input.tools?.forEach((tool) => {
      deepseekTools.push({
        type: 'function',
        function: {
          name: tool.name,
          description: tool.description,
          parameters: z.toJSONSchema(tool.schema),
        },
      });
    });

    const stream = await this.deepseekClient.chat.completions.create({
      model: this.config.model,
      messages: this.convertToDeepSeekMessages(input.messages),
      tools: deepseekTools.length > 0 ? deepseekTools : undefined,
      temperature: input.options?.temperature ?? 1.0,
      top_p: input.options?.topP,
      max_completion_tokens: input.options?.maxTokens,
      stop: input.options?.stopSequences,
      frequency_penalty: input.options?.frequencyPenalty,
      presence_penalty: input.options?.presencePenalty,
      stream: true,
    });

    let recievedToolCalls: { name: string; id: string; arguments: string }[] =
      [];

    for await (const chunk of stream) {
      if (chunk.choices && chunk.choices.length > 0) {
        const toolCalls = chunk.choices[0].delta.tool_calls;
        yield {
          contentChunk: chunk.choices[0].delta.content || '',
          toolCallChunk:
            toolCalls?.map((tc) => {
              if (!recievedToolCalls[tc.index]) {
                const call = {
                  name: tc.function?.name!,
                  id: tc.id!,
                  arguments: tc.function?.arguments || '',
                };
                recievedToolCalls.push(call);
                return { ...call, arguments: parse(call.arguments || '{}') };
              } else {
                const existingCall = recievedToolCalls[tc.index];
                existingCall.arguments += tc.function?.arguments || '';
                return {
                  ...existingCall,
                  arguments: parse(existingCall.arguments),
                };
              }
            }) || [],
          done: chunk.choices[0].finish_reason !== null,
          additionalInfo: {
            finishReason: chunk.choices[0].finish_reason,
          },
        };
      }
    }
  }

  async generateObject<T>(input: GenerateObjectInput): Promise<T> {
    // DeepSeek doesn't support native JSON schema response format like OpenAI
    // So we use the standard completion with a system prompt
    const response = await this.deepseekClient.chat.completions.create({
      messages: [
        ...this.convertToDeepSeekMessages(input.messages),
        {
          role: 'system',
          content: `You must respond with valid JSON that matches the following schema: ${JSON.stringify(z.toJSONSchema(input.schema))}. Do not include any markdown formatting, explanations, or extra text - only the raw JSON object.`,
        },
      ],
      model: this.config.model,
      temperature: input.options?.temperature ?? 1.0,
      top_p: input.options?.topP,
      max_completion_tokens: input.options?.maxTokens,
      stop: input.options?.stopSequences,
      frequency_penalty: input.options?.frequencyPenalty,
      presence_penalty: input.options?.presencePenalty,
    });

    if (response.choices && response.choices.length > 0) {
      try {
        const content = response.choices[0].message.content!;
        const repaired = repairJson(content, {
          extractJson: true,
        }) as string;
        return input.schema.parse(JSON.parse(repaired)) as T;
      } catch (err) {
        throw new Error(`Error parsing response from DeepSeek: ${err}`);
      }
    }

    throw new Error('No response from DeepSeek');
  }

  async *streamObject<T>(input: GenerateObjectInput): AsyncGenerator<T> {
    // DeepSeek doesn't support native streaming JSON response format
    // Fall back to non-streaming for object generation
    const result = await this.generateObject<T>(input);
    yield result;
  }
}

export default DeepSeekLLM;
