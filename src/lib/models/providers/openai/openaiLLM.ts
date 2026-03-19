import OpenAI from 'openai';
import BaseLLM from '../../base/llm';
import {
  GenerateObjectInput,
  GenerateOptions,
  GenerateTextInput,
  GenerateTextOutput,
  StreamTextOutput,
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
import { safeParseJson, stripMarkdownFences } from '@/lib/utils/parseJson';

type OpenAIConfig = {
  apiKey: string;
  model: string;
  baseURL?: string;
  options?: GenerateOptions;
};

class OpenAILLM extends BaseLLM<OpenAIConfig> {
  openAIClient: OpenAI;

  constructor(protected config: OpenAIConfig) {
    super(config);

    this.openAIClient = new OpenAI({
      apiKey: this.config.apiKey,
      baseURL: this.config.baseURL || 'https://api.openai.com/v1',
    });
  }

  convertToOpenAIMessages(messages: Message[]): ChatCompletionMessageParam[] {
    return messages.map((msg): ChatCompletionMessageParam | null => {
      if (msg.role === 'tool') {
        if (!msg.id) {
          return null; // Skip tool messages without a tool_call_id
        }
        return {
          role: 'tool',
          tool_call_id: msg.id,
          content: msg.content || '',
        } as ChatCompletionToolMessageParam;
      } else if (msg.role === 'assistant') {
        const validToolCalls = msg.tool_calls?.filter(
          (tc) => tc.id && tc.name,
        );
        return {
          role: 'assistant',
          content: msg.content || '',
          ...(validToolCalls &&
            validToolCalls.length > 0 && {
              tool_calls: validToolCalls.map((tc) => ({
                id: tc.id,
                type: 'function',
                function: {
                  name: tc.name,
                  arguments:
                    typeof tc.arguments === 'string'
                      ? tc.arguments
                      : JSON.stringify(tc.arguments || {}),
                },
              })),
            }),
        } as ChatCompletionAssistantMessageParam;
      }

      return msg;
    }).filter((msg): msg is ChatCompletionMessageParam => msg !== null);
  }

  async generateText(input: GenerateTextInput): Promise<GenerateTextOutput> {
    const openaiTools: ChatCompletionTool[] = [];

    input.tools?.forEach((tool) => {
      openaiTools.push({
        type: 'function',
        function: {
          name: tool.name,
          description: tool.description,
          parameters: z.toJSONSchema(tool.schema),
        },
      });
    });

    const response = await this.openAIClient.chat.completions.create({
      model: this.config.model,
      tools: openaiTools.length > 0 ? openaiTools : undefined,
      messages: this.convertToOpenAIMessages(input.messages),
      temperature:
        input.options?.temperature ?? this.config.options?.temperature ?? 1.0,
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
      return {
        content: response.choices[0].message?.content ?? '',
        toolCalls:
          response.choices[0].message?.tool_calls
            ?.map((tc) => {
              if (tc.type === 'function') {
                return {
                  name: tc.function.name,
                  id: tc.id,
                  arguments: safeParseJson<Record<string, any>>(tc.function.arguments) ?? {},
                };
              }
            })
            .filter((tc) => tc !== undefined) || [],
        additionalInfo: {
          finishReason: response.choices[0].finish_reason,
        },
      };
    }

    throw new Error('No response from OpenAI');
  }

  async *streamText(
    input: GenerateTextInput,
  ): AsyncGenerator<StreamTextOutput> {
    const openaiTools: ChatCompletionTool[] = [];

    input.tools?.forEach((tool) => {
      openaiTools.push({
        type: 'function',
        function: {
          name: tool.name,
          description: tool.description,
          parameters: z.toJSONSchema(tool.schema),
        },
      });
    });

    const stream = await this.openAIClient.chat.completions.create({
      model: this.config.model,
      messages: this.convertToOpenAIMessages(input.messages),
      tools: openaiTools.length > 0 ? openaiTools : undefined,
      temperature:
        input.options?.temperature ?? this.config.options?.temperature ?? 1.0,
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

    let recievedToolCalls: { name: string; id: string; arguments: string }[] =
      [];

    for await (const chunk of stream) {
      if (chunk.choices && chunk.choices.length > 0) {
        const toolCalls = chunk.choices[0].delta.tool_calls;
        let parsedToolCalls: any[] = [];

        if (toolCalls) {
          for (const tc of toolCalls) {
            try {
              if (!recievedToolCalls[tc.index]) {
                recievedToolCalls[tc.index] = {
                  name: tc.function?.name || '',
                  id: tc.id || '',
                  arguments: tc.function?.arguments || '',
                };
              } else {
                const existingCall = recievedToolCalls[tc.index];
                if (tc.function?.name) existingCall.name = tc.function.name;
                if (tc.id) existingCall.id = tc.id;
                existingCall.arguments += tc.function?.arguments || '';
              }

              // Only emit parsed tool call when arguments parse successfully
              const current = recievedToolCalls[tc.index];
              if (current.arguments) {
                try {
                  parsedToolCalls.push({
                    ...current,
                    arguments: parse(current.arguments),
                  });
                } catch {
                  // Arguments still incomplete — will retry on next chunk
                }
              }
            } catch (parseErr) {
              console.error('Error parsing tool call:', parseErr instanceof Error ? parseErr.message : parseErr, 'tool:', tc.function?.name, 'index:', tc.index);
            }
          }
        }

        yield {
          contentChunk: chunk.choices[0].delta.content || '',
          toolCallChunk: parsedToolCalls,
          done: chunk.choices[0].finish_reason !== null,
          additionalInfo: {
            finishReason: chunk.choices[0].finish_reason,
          },
        };
      }
    }
  }

  async generateObject<T>(input: GenerateObjectInput): Promise<T> {
    // Use chat.completions.create instead of chat.completions.parse
    // for compatibility with OpenAI-compatible providers (OpenRouter, etc.)
    // that don't support the /chat/completions/parse endpoint.
    const schemaInstruction = JSON.stringify(
      z.toJSONSchema(input.schema),
      null,
      2,
    );

    const response = await this.openAIClient.chat.completions.create({
      messages: [
        {
          role: 'system',
          content: `You must respond with valid JSON only. No markdown code blocks, no explanatory text.\n\nReturn an object matching this JSON Schema:\n${schemaInstruction}`,
        },
        ...this.convertToOpenAIMessages(input.messages),
      ],
      model: this.config.model,
      temperature:
        input.options?.temperature ?? this.config.options?.temperature ?? 1.0,
      top_p: input.options?.topP ?? this.config.options?.topP,
      max_completion_tokens:
        input.options?.maxTokens ?? this.config.options?.maxTokens,
      stop: input.options?.stopSequences ?? this.config.options?.stopSequences,
      frequency_penalty:
        input.options?.frequencyPenalty ??
        this.config.options?.frequencyPenalty,
      presence_penalty:
        input.options?.presencePenalty ?? this.config.options?.presencePenalty,
      response_format: { type: 'json_object' },
    });

    if (response.choices && response.choices.length > 0) {
      try {
        const content = stripMarkdownFences(
          response.choices[0].message.content || '',
        );
        if (!content.trim()) {
          throw new Error('Empty response from model');
        }
        let repairedJson: string;
        try {
          repairedJson = repairJson(content, {
            extractJson: true,
          }) as string;
        } catch (repairErr) {
          console.error('repairJson failed', { contentLength: content.length, error: repairErr instanceof Error ? repairErr.message : String(repairErr) });
          throw new Error(`Failed to repair JSON: ${repairErr}`);
        }
        return input.schema.parse(JSON.parse(repairedJson)) as T;
      } catch (err) {
        throw new Error(`Error parsing response from OpenAI: ${err}`);
      }
    }

    throw new Error('No response from OpenAI');
  }

  async *streamObject<T>(input: GenerateObjectInput): AsyncGenerator<T> {
    let receivedObj: string = '';

    // Use chat.completions.create with streaming instead of responses.stream
    // for compatibility with OpenAI-compatible providers (OpenRouter, etc.)
    // that don't support the OpenAI Responses API.
    const schemaInstruction = JSON.stringify(
      z.toJSONSchema(input.schema),
      null,
      2,
    );

    const stream = await this.openAIClient.chat.completions.create({
      model: this.config.model,
      messages: [
        {
          role: 'system',
          content: `You must respond with valid JSON only. No markdown code blocks, no explanatory text.\n\nReturn an object matching this JSON Schema:\n${schemaInstruction}`,
        },
        ...this.convertToOpenAIMessages(input.messages),
      ],
      temperature:
        input.options?.temperature ?? this.config.options?.temperature ?? 1.0,
      top_p: input.options?.topP ?? this.config.options?.topP,
      max_completion_tokens:
        input.options?.maxTokens ?? this.config.options?.maxTokens,
      stop: input.options?.stopSequences ?? this.config.options?.stopSequences,
      frequency_penalty:
        input.options?.frequencyPenalty ??
        this.config.options?.frequencyPenalty,
      presence_penalty:
        input.options?.presencePenalty ?? this.config.options?.presencePenalty,
      response_format: { type: 'json_object' },
      stream: true,
    });

    for await (const chunk of stream) {
      if (chunk.choices && chunk.choices.length > 0) {
        const delta = chunk.choices[0].delta.content || '';
        receivedObj += delta;

        // Strip markdown fences if present
        const cleanedObj = stripMarkdownFences(receivedObj);

        try {
          yield parse(cleanedObj) as T;
        } catch (err) {
          // Partial JSON may not be parseable yet, skip
          continue;
        }
      }
    }
  }
}

export default OpenAILLM;
