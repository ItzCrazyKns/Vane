import Anthropic from '@anthropic-ai/sdk';
import type {
  ContentBlock,
  ContentBlockParam,
  MessageCreateParamsBase,
  MessageParam,
  RawMessageStreamEvent,
  Tool as AnthropicTool,
} from '@anthropic-ai/sdk/resources/messages';
import { repairJson } from '@toolsycc/json-repair';
import { Message } from '@/lib/types';
import { parse } from 'partial-json';
import z from 'zod';
import BaseLLM from '../../base/llm';
import {
  GenerateObjectInput,
  GenerateOptions,
  GenerateTextInput,
  GenerateTextOutput,
  StreamTextOutput,
  ToolCall,
} from '../../types';

type MiniMaxAnthropicConfig = {
  apiKey: string;
  model: string;
  baseURL: string;
  options?: GenerateOptions;
};

type ConvertedMessages = {
  messages: MessageParam[];
  system?: string;
};

type StreamingToolCall = {
  argumentsJson: string;
  id: string;
  name: string;
};

const toArguments = (value: unknown): Record<string, any> => {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, any>;
  }

  return {};
};

class MiniMaxAnthropicLLM extends BaseLLM<MiniMaxAnthropicConfig> {
  private anthropicClient: Anthropic;
  private preservedContent = new Map<string, ContentBlockParam[]>();

  constructor(protected config: MiniMaxAnthropicConfig) {
    super(config);

    this.anthropicClient = new Anthropic({
      apiKey: this.config.apiKey,
      baseURL: this.config.baseURL,
    });
  }

  private convertMessages(messages: Message[]): ConvertedMessages {
    const system = messages
      .filter((message) => message.role === 'system')
      .map((message) => message.content)
      .join('\n\n');

    const convertedMessages: MessageParam[] = [];

    for (let index = 0; index < messages.length; index++) {
      const message = messages[index];

      if (message.role === 'system') {
        continue;
      }

      if (message.role === 'tool') {
        const content: ContentBlockParam[] = [];

        while (index < messages.length && messages[index].role === 'tool') {
          const toolMessage = messages[index];

          if (toolMessage.role === 'tool') {
            content.push({
              type: 'tool_result',
              tool_use_id: toolMessage.id,
              content: toolMessage.content,
            });
          }

          index++;
        }

        index--;
        convertedMessages.push({ role: 'user', content });
        continue;
      }

      if (message.role === 'assistant' && message.tool_calls?.length) {
        const preservedContent = message.tool_calls
          .map((toolCall) => this.preservedContent.get(toolCall.id))
          .find((content) => content !== undefined);

        if (preservedContent) {
          convertedMessages.push({
            role: 'assistant',
            content: preservedContent,
          });
          continue;
        }

        const content: ContentBlockParam[] = [];

        if (message.content) {
          content.push({ type: 'text', text: message.content });
        }

        content.push(
          ...message.tool_calls.map((toolCall) => ({
            type: 'tool_use' as const,
            id: toolCall.id,
            name: toolCall.name,
            input: toolCall.arguments,
          })),
        );

        convertedMessages.push({ role: 'assistant', content });
        continue;
      }

      convertedMessages.push({
        role: message.role,
        content: message.content,
      });
    }

    return {
      messages: convertedMessages,
      ...(system ? { system } : {}),
    };
  }

  private convertTools(input: GenerateTextInput): AnthropicTool[] | undefined {
    if (!input.tools?.length) {
      return undefined;
    }

    return input.tools.map((tool) => ({
      name: tool.name,
      description: tool.description,
      input_schema: z.toJSONSchema(tool.schema) as AnthropicTool.InputSchema,
    }));
  }

  private createParams(input: GenerateTextInput): MessageCreateParamsBase {
    const convertedMessages = this.convertMessages(input.messages);

    return {
      model: this.config.model,
      messages: convertedMessages.messages,
      max_tokens:
        input.options?.maxTokens ?? this.config.options?.maxTokens ?? 8192,
      system: convertedMessages.system,
      tools: this.convertTools(input),
      temperature:
        input.options?.temperature ?? this.config.options?.temperature ?? 1,
      top_p: input.options?.topP ?? this.config.options?.topP,
      stop_sequences:
        input.options?.stopSequences ?? this.config.options?.stopSequences,
    };
  }

  private rememberContent(content: ContentBlock[]): void {
    const requestContent = content.flatMap<ContentBlockParam>((block) => {
      if (block.type === 'text') {
        return [{ type: 'text', text: block.text }];
      }

      if (block.type === 'thinking') {
        return [
          {
            type: 'thinking',
            thinking: block.thinking,
            signature: block.signature,
          },
        ];
      }

      if (block.type === 'redacted_thinking') {
        return [{ type: 'redacted_thinking', data: block.data }];
      }

      if (block.type === 'tool_use') {
        return [
          {
            type: 'tool_use',
            id: block.id,
            name: block.name,
            input: block.input,
          },
        ];
      }

      return [];
    });
    const toolCallIds = requestContent
      .filter((block) => block.type === 'tool_use')
      .map((block) => block.id);

    toolCallIds.forEach((id) => this.preservedContent.set(id, requestContent));

    while (this.preservedContent.size > 100) {
      const oldestKey = this.preservedContent.keys().next().value;

      if (!oldestKey) {
        break;
      }

      this.preservedContent.delete(oldestKey);
    }
  }

  async generateText(input: GenerateTextInput): Promise<GenerateTextOutput> {
    const response = await this.anthropicClient.messages.create({
      ...this.createParams(input),
      stream: false,
    });

    this.rememberContent(response.content);

    const content = response.content
      .filter((block) => block.type === 'text')
      .map((block) => block.text)
      .join('');
    const toolCalls = response.content
      .filter((block) => block.type === 'tool_use')
      .map<ToolCall>((block) => ({
        id: block.id,
        name: block.name,
        arguments: toArguments(block.input),
      }));

    return {
      content,
      toolCalls,
      additionalInfo: {
        finishReason: response.stop_reason,
      },
    };
  }

  async *streamText(
    input: GenerateTextInput,
  ): AsyncGenerator<StreamTextOutput> {
    const stream = this.anthropicClient.messages.stream(
      this.createParams(input),
    );
    const toolCalls = new Map<number, StreamingToolCall>();
    let finishReason: string | null = null;
    let doneEmitted = false;

    for await (const event of stream as AsyncIterable<RawMessageStreamEvent>) {
      if (
        event.type === 'content_block_start' &&
        event.content_block.type === 'tool_use'
      ) {
        const toolCall = {
          argumentsJson: '',
          id: event.content_block.id,
          name: event.content_block.name,
        };

        toolCalls.set(event.index, toolCall);
        yield {
          contentChunk: '',
          toolCallChunk: [
            {
              id: toolCall.id,
              name: toolCall.name,
              arguments: toArguments(event.content_block.input),
            },
          ],
        };
      } else if (
        event.type === 'content_block_delta' &&
        event.delta.type === 'text_delta'
      ) {
        yield {
          contentChunk: event.delta.text,
          toolCallChunk: [],
        };
      } else if (
        event.type === 'content_block_delta' &&
        event.delta.type === 'input_json_delta'
      ) {
        const toolCall = toolCalls.get(event.index);

        if (!toolCall) {
          continue;
        }

        toolCall.argumentsJson += event.delta.partial_json;

        try {
          yield {
            contentChunk: '',
            toolCallChunk: [
              {
                id: toolCall.id,
                name: toolCall.name,
                arguments: toArguments(parse(toolCall.argumentsJson)),
              },
            ],
          };
        } catch {
          continue;
        }
      } else if (event.type === 'message_delta') {
        finishReason = event.delta.stop_reason;
        doneEmitted = finishReason !== null;
        yield {
          contentChunk: '',
          toolCallChunk: [],
          done: doneEmitted,
          additionalInfo: {
            finishReason,
          },
        };
      } else if (event.type === 'message_stop' && !doneEmitted) {
        yield {
          contentChunk: '',
          toolCallChunk: [],
          done: true,
          additionalInfo: {
            finishReason,
          },
        };
      }
    }

    this.rememberContent((await stream.finalMessage()).content);
  }

  async generateObject<T>(input: GenerateObjectInput): Promise<T> {
    const response = await this.generateText(input);

    return input.schema.parse(
      JSON.parse(
        repairJson(response.content, {
          extractJson: true,
        }) as string,
      ),
    ) as T;
  }

  async *streamObject<T>(input: GenerateObjectInput): AsyncGenerator<T> {
    let receivedObject = '';

    for await (const chunk of this.streamText(input)) {
      receivedObject += chunk.contentChunk;

      try {
        yield parse(receivedObject) as T;
      } catch {
        continue;
      }
    }
  }
}

export default MiniMaxAnthropicLLM;
