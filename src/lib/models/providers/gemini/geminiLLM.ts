import { GoogleGenAI, Content, Part, Tool as GeminiTool } from '@google/genai';
import BaseLLM from '../../base/llm';
import {
  GenerateObjectInput,
  GenerateOptions,
  GenerateTextInput,
  GenerateTextOutput,
  StreamTextOutput,
  Tool,
  ToolCall,
} from '../../types';
import { Message } from '@/lib/types';
import { parse } from 'partial-json';
import { repairJson } from '@toolsycc/json-repair';
import crypto from 'crypto';
import z from 'zod';

type GeminiConfig = {
  apiKey: string;
  model: string;
  options?: GenerateOptions;
};

type ConvertedMessages = {
  systemInstruction?: string;
  contents: Content[];
};

class GeminiLLM extends BaseLLM<GeminiConfig> {
  private genAI: GoogleGenAI;

  constructor(config: GeminiConfig) {
    super(config);
    this.genAI = new GoogleGenAI({ apiKey: config.apiKey });
  }

  /**
   * Convert Message[] to Gemini Content[] format
   * - 'system' messages are extracted to systemInstruction
   * - 'assistant' becomes 'model' role
   * - 'tool' messages become functionResponse parts with 'user' role
   */
  private convertToGeminiContents(messages: Message[]): ConvertedMessages {
    let systemInstruction: string | undefined;
    const contents: Content[] = [];

    // Group consecutive tool messages together
    let pendingToolResponses: Part[] = [];

    const flushToolResponses = () => {
      if (pendingToolResponses.length > 0) {
        contents.push({
          role: 'user',
          parts: pendingToolResponses,
        });
        pendingToolResponses = [];
      }
    };

    for (const msg of messages) {
      if (msg.role === 'system') {
        // Extract system message to systemInstruction
        systemInstruction = msg.content;
      } else if (msg.role === 'user') {
        flushToolResponses();
        contents.push({
          role: 'user',
          parts: [{ text: msg.content }],
        });
      } else if (msg.role === 'assistant') {
        flushToolResponses();
        const parts: Part[] = [];

        // Add text content if present
        if (msg.content) {
          parts.push({ text: msg.content });
        }

        // Add function calls if present
        if (msg.tool_calls && msg.tool_calls.length > 0) {
          for (const tc of msg.tool_calls) {
            const part: Part = {
              functionCall: {
                id: tc.id,
                name: tc.name,
                args: tc.arguments,
              },
            };
            // Add thoughtSignature as sibling if present (required for Gemini 3 models)
            if (tc.thoughtSignature) {
              (part as any).thoughtSignature = tc.thoughtSignature;
            }
            parts.push(part);
          }
        }

        if (parts.length > 0) {
          contents.push({
            role: 'model',
            parts,
          });
        }
      } else if (msg.role === 'tool') {
        // Tool messages become functionResponse parts
        // Parse the content as JSON if possible, otherwise wrap it
        let responseData: Record<string, unknown>;
        try {
          responseData = JSON.parse(msg.content);
        } catch {
          responseData = { result: msg.content };
        }

        pendingToolResponses.push({
          functionResponse: {
            id: msg.id,
            name: msg.name,
            response: responseData,
          },
        });
      }
    }

    flushToolResponses();

    return { systemInstruction, contents };
  }

  /**
   * Convert Tool[] to Gemini function declarations format
   */
  private convertToGeminiTools(tools: Tool[]): GeminiTool[] {
    if (!tools || tools.length === 0) {
      return [];
    }

    return [
      {
        functionDeclarations: tools.map((tool) => ({
          name: tool.name,
          description: tool.description,
          parametersJsonSchema: z.toJSONSchema(tool.schema),
        })),
      },
    ];
  }

  /**
   * Generate a consistent tool call ID using SHA256 hash
   * Gemini doesn't always provide IDs, so we generate them
   */
  private generateToolCallId(index: number, name: string): string {
    return crypto
      .createHash('sha256')
      .update(`${index}-${name}`)
      .digest('hex')
      .slice(0, 16);
  }

  /**
   * Build generation config from options
   * Note: frequency_penalty and presence_penalty are NOT included
   * as they cause 400 errors with some Gemini models
   */
  private buildGenerationConfig(options?: GenerateOptions) {
    return {
      // Default temperature 0.7 for more focused outputs (OpenAI defaults to 1.0)
      temperature: options?.temperature ?? this.config.options?.temperature ?? 0.7,
      maxOutputTokens: options?.maxTokens ?? this.config.options?.maxTokens,
      topP: options?.topP ?? this.config.options?.topP,
      stopSequences: options?.stopSequences ?? this.config.options?.stopSequences,
    };
  }

  async generateText(input: GenerateTextInput): Promise<GenerateTextOutput> {
    const { systemInstruction, contents } = this.convertToGeminiContents(
      input.messages,
    );
    const geminiTools = this.convertToGeminiTools(input.tools || []);

    const response = await this.genAI.models.generateContent({
      model: this.config.model,
      contents,
      config: {
        systemInstruction,
        ...this.buildGenerationConfig(input.options),
        tools: geminiTools.length > 0 ? geminiTools : undefined,
      },
    });

    // Validate response before accessing properties
    if (!response) {
      throw new Error(
        'Gemini API returned an empty response. The request may have failed or been blocked.',
      );
    }

    // Check if response has any content (text or function calls)
    const hasText = response.text !== undefined && response.text !== null;
    const hasFunctionCalls =
      response.functionCalls && response.functionCalls.length > 0;

    if (!hasText && !hasFunctionCalls) {
      // Check for candidates to provide more context on why response is empty
      const candidates = response.candidates;
      if (candidates && candidates.length > 0) {
        const finishReason = candidates[0].finishReason;
        if (finishReason && finishReason !== 'STOP') {
          throw new Error(
            `Gemini API returned an empty response. Finish reason: ${finishReason}. The content may have been blocked or filtered.`,
          );
        }
      }
      // Response is empty but no explicit error - this is valid (empty text response)
    }

    const toolCalls: ToolCall[] = [];
    const functionCalls = response.functionCalls;
    if (functionCalls && functionCalls.length > 0) {
      functionCalls.forEach((fc, index) => {
        toolCalls.push({
          id: fc.id || this.generateToolCallId(index, fc.name || 'unknown'),
          name: fc.name || 'unknown',
          arguments: (fc.args as Record<string, unknown>) || {},
          thoughtSignature: (fc as any).thoughtSignature,
        });
      });
    }

    // Extract finishReason from candidates if available
    const finishReason = response.candidates?.[0]?.finishReason;

    return {
      content: response.text || '',
      toolCalls,
      additionalInfo: {
        finishReason,
      },
    };
  }

  async *streamText(
    input: GenerateTextInput,
  ): AsyncGenerator<StreamTextOutput> {
    const { systemInstruction, contents } = this.convertToGeminiContents(
      input.messages,
    );
    const geminiTools = this.convertToGeminiTools(input.tools || []);

    const stream = await this.genAI.models.generateContentStream({
      model: this.config.model,
      contents,
      config: {
        systemInstruction,
        ...this.buildGenerationConfig(input.options),
        tools: geminiTools.length > 0 ? geminiTools : undefined,
      },
    });

    // Accumulate tool calls across chunks
    const accumulatedToolCalls: Map<
      string,
      { id: string; name: string; arguments: Record<string, unknown>; thoughtSignature?: string }
    > = new Map();

    // Track the last finishReason during streaming
    let lastFinishReason: string | undefined;

    // Counter for generating unique tool call IDs across all chunks
    let toolCallCounter = 0;

    for await (const chunk of stream) {
      // Process any function calls in this chunk
      const functionCalls = chunk.functionCalls;
      if (functionCalls && functionCalls.length > 0) {
        functionCalls.forEach((fc) => {
          const id =
            fc.id || this.generateToolCallId(toolCallCounter++, fc.name || 'unknown');
          // Update or add the tool call
          accumulatedToolCalls.set(id, {
            id,
            name: fc.name || 'unknown',
            arguments: (fc.args as Record<string, unknown>) || {},
            thoughtSignature: (fc as any).thoughtSignature,
          });
        });
      }

      // Extract finishReason from candidates if available
      const finishReason = chunk.candidates?.[0]?.finishReason;
      if (finishReason) {
        lastFinishReason = finishReason;
      }

      yield {
        contentChunk: chunk.text || '',
        toolCallChunk: Array.from(accumulatedToolCalls.values()),
        done: false,
        additionalInfo: {
          finishReason,
        },
      };
    }

    // Final yield with done=true
    yield {
      contentChunk: '',
      toolCallChunk: Array.from(accumulatedToolCalls.values()),
      done: true,
      additionalInfo: {
        finishReason: lastFinishReason,
      },
    };
  }

  async generateObject<T>(input: GenerateObjectInput): Promise<T> {
    const { systemInstruction, contents } = this.convertToGeminiContents(
      input.messages,
    );

    const response = await this.genAI.models.generateContent({
      model: this.config.model,
      contents,
      config: {
        systemInstruction,
        ...this.buildGenerationConfig(input.options),
        responseMimeType: 'application/json',
        responseJsonSchema: z.toJSONSchema(input.schema),
      },
    });

    try {
      const text = response.text || '';
      const repaired = repairJson(text, { extractJson: true }) as string;
      return input.schema.parse(JSON.parse(repaired)) as T;
    } catch (err) {
      throw new Error(`Error parsing response from Gemini: ${err}`);
    }
  }

  async *streamObject<T>(input: GenerateObjectInput): AsyncGenerator<T> {
    const { systemInstruction, contents } = this.convertToGeminiContents(
      input.messages,
    );

    const stream = await this.genAI.models.generateContentStream({
      model: this.config.model,
      contents,
      config: {
        systemInstruction,
        ...this.buildGenerationConfig(input.options),
        responseMimeType: 'application/json',
        responseJsonSchema: z.toJSONSchema(input.schema),
      },
    });

    let receivedObj = '';

    for await (const chunk of stream) {
      receivedObj += chunk.text || '';

      try {
        yield parse(receivedObj) as T;
      } catch {
        // Expected for incomplete JSON - wait for more chunks
      }
    }

    // After loop: validate and yield final object
    if (receivedObj) {
      try {
        const repaired = repairJson(receivedObj, { extractJson: true }) as string;
        const finalObject = input.schema.parse(JSON.parse(repaired));
        yield finalObject as T;
      } catch (err) {
        throw new Error(`Stream ended with invalid JSON object: ${err}`);
      }
    }
  }
}

export default GeminiLLM;
