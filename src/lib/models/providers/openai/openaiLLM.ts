import OpenAI from 'openai';
import BaseLLM from '../../base/llm';
import { zodTextFormat, zodResponseFormat } from 'openai/helpers/zod';
import {
  GenerateObjectInput,
  GenerateOptions,
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

type OpenAIConfig = {
  apiKey: string;
  model: string;
  baseURL?: string;
  options?: GenerateOptions;
};

/*
 * Utility calls (classification, widgets, structured output) should never be
 * able to keep a chat request open indefinitely. Streaming answers are left
 * untouched because a long answer is legitimate.
 */
const NON_STREAMING_TIMEOUT_MS = 2 * 60 * 1000;
const NON_STREAMING_MAX_RETRIES = 1;

const REQUEST_OPTIONS = {
  timeout: NON_STREAMING_TIMEOUT_MS,
  maxRetries: NON_STREAMING_MAX_RETRIES,
};

/*
 * Streaming has no overall timeout because a long answer is legitimate, but a
 * provider that silently stops sending chunks must not hang the chat forever.
 */
const STREAM_IDLE_TIMEOUT_MS = 90 * 1000;

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
    }, REQUEST_OPTIONS);

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

    /*
     * A provider that stops sending chunks without closing the connection would
     * block this loop forever, and the route would never be able to emit an
     * error. Abort when no chunk has arrived for a while; the timer is reset on
     * every chunk, so long answers are still allowed.
     */
    const abortController = new AbortController();
    let idleTimer: ReturnType<typeof setTimeout> | undefined;
    let idleTimedOut = false;

    const resetIdleTimer = () => {
      if (idleTimer) clearTimeout(idleTimer);
      idleTimer = setTimeout(() => {
        idleTimedOut = true;
        abortController.abort();
      }, STREAM_IDLE_TIMEOUT_MS);
    };

    resetIdleTimer();

    try {
      const stream = await this.openAIClient.chat.completions.create(
        {
          model: this.config.model,
          messages: this.convertToOpenAIMessages(input.messages),
          tools: openaiTools.length > 0 ? openaiTools : undefined,
          temperature:
            input.options?.temperature ??
            this.config.options?.temperature ??
            1.0,
          top_p: input.options?.topP ?? this.config.options?.topP,
          max_completion_tokens:
            input.options?.maxTokens ?? this.config.options?.maxTokens,
          stop:
            input.options?.stopSequences ?? this.config.options?.stopSequences,
          frequency_penalty:
            input.options?.frequencyPenalty ??
            this.config.options?.frequencyPenalty,
          presence_penalty:
            input.options?.presencePenalty ??
            this.config.options?.presencePenalty,
          stream: true,
        },
        { signal: abortController.signal },
      );

      let recievedToolCalls: {
        name: string;
        id: string;
        arguments: string;
      }[] = [];

      for await (const chunk of stream) {
        resetIdleTimer();

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
    } catch (err) {
      if (idleTimedOut) {
        throw new Error(
          `The model provider stopped sending data for ${Math.round(
            STREAM_IDLE_TIMEOUT_MS / 1000,
          )} seconds and the request was aborted.`,
        );
      }

      throw err;
    } finally {
      if (idleTimer) clearTimeout(idleTimer);
    }
  }

  async generateObject<T>(input: GenerateObjectInput): Promise<T> {
    const response = await this.openAIClient.chat.completions.parse({
      messages: this.convertToOpenAIMessages(input.messages),
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
      response_format: zodResponseFormat(input.schema, 'object'),
    }, REQUEST_OPTIONS);

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
        throw new Error(`Error parsing response from OpenAI: ${err}`);
      }
    }

    throw new Error('No response from OpenAI');
  }

  async *streamObject<T>(input: GenerateObjectInput): AsyncGenerator<T> {
    let recievedObj: string = '';

    const stream = this.openAIClient.responses.stream({
      model: this.config.model,
      input: input.messages,
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
      text: {
        format: zodTextFormat(input.schema, 'object'),
      },
    });

    for await (const chunk of stream) {
      if (chunk.type === 'response.output_text.delta' && chunk.delta) {
        recievedObj += chunk.delta;

        try {
          yield parse(recievedObj) as T;
        } catch (err) {
          console.log('Error parsing partial object from OpenAI:', err);
          yield {} as T;
        }
      } else if (chunk.type === 'response.output_text.done' && chunk.text) {
        try {
          yield parse(chunk.text) as T;
        } catch (err) {
          throw new Error(`Error parsing response from OpenAI: ${err}`);
        }
      }
    }
  }
}

export default OpenAILLM;
