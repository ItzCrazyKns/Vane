import OpenAILLM from '../openai/openaiLLM';
import { GenerateObjectInput } from '../../types';
import z from 'zod';
import { repairJson } from '@toolsycc/json-repair';

/**
 * LM Studio LLM implementation.
 *
 * Extends OpenAILLM but overrides generateObject because LM Studio
 * (and most OpenAI-compatible APIs) don't support OpenAI's structured
 * output feature (zodResponseFormat / chat.completions.parse).
 *
 * Instead, we use the standard chat completion endpoint with JSON mode
 * and parse the response manually.
 *
 * Contributed by The Noble House™ AI Lab (https://thenoblehouse.ai)
 */
class LMStudioLLM extends OpenAILLM {
  /**
   * Generate a structured object response from the LLM.
   *
   * Uses standard chat completion with JSON mode instead of OpenAI's
   * structured output feature for compatibility with LM Studio.
   */
  async generateObject<T>(input: GenerateObjectInput): Promise<T> {
    // Convert schema to JSON schema for the prompt
    const jsonSchema = z.toJSONSchema(input.schema);

    // Build messages with JSON instruction
    const messagesWithJsonInstruction = [
      ...input.messages.slice(0, -1), // All messages except the last
      {
        ...input.messages[input.messages.length - 1],
        content: `${input.messages[input.messages.length - 1].content}\n\nRespond with a valid JSON object matching this schema:\n${JSON.stringify(jsonSchema, null, 2)}`,
      },
    ];

    try {
      const response = await this.openAIClient.chat.completions.create({
        model: this.config.model,
        messages: this.convertToOpenAIMessages(messagesWithJsonInstruction),
        temperature:
          input.options?.temperature ?? this.config.options?.temperature ?? 0.7,
        top_p: input.options?.topP ?? this.config.options?.topP,
        max_tokens:
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
        const content = response.choices[0].message.content;
        if (!content) {
          throw new Error('Empty response from LM Studio');
        }

        try {
          const parsed = JSON.parse(
            repairJson(content, { extractJson: true }) as string
          );
          return input.schema.parse(parsed) as T;
        } catch (parseErr) {
          throw new Error(`Error parsing JSON response from LM Studio: ${parseErr}`);
        }
      }

      throw new Error('No response from LM Studio');
    } catch (err: any) {
      // If JSON mode isn't supported, try without it
      if (err.message?.includes('response_format') || err.status === 400) {
        return this.generateObjectWithoutJsonMode<T>(input, jsonSchema);
      }
      throw err;
    }
  }

  /**
   * Fallback method for models that don't support response_format.
   * Uses prompt engineering to get JSON output.
   */
  private async generateObjectWithoutJsonMode<T>(
    input: GenerateObjectInput,
    jsonSchema: object,
  ): Promise<T> {
    // Add stronger JSON instruction when JSON mode isn't available
    const messagesWithJsonInstruction = [
      {
        role: 'system' as const,
        content: `You must respond with valid JSON only. No markdown, no explanations, just the JSON object.`,
      },
      ...input.messages.slice(0, -1),
      {
        ...input.messages[input.messages.length - 1],
        content: `${input.messages[input.messages.length - 1].content}\n\nRespond with ONLY a valid JSON object (no markdown code blocks) matching this schema:\n${JSON.stringify(jsonSchema, null, 2)}`,
      },
    ];

    const response = await this.openAIClient.chat.completions.create({
      model: this.config.model,
      messages: this.convertToOpenAIMessages(messagesWithJsonInstruction),
      temperature:
        input.options?.temperature ?? this.config.options?.temperature ?? 0.7,
      top_p: input.options?.topP ?? this.config.options?.topP,
      max_tokens:
        input.options?.maxTokens ?? this.config.options?.maxTokens,
      stop: input.options?.stopSequences ?? this.config.options?.stopSequences,
      frequency_penalty:
        input.options?.frequencyPenalty ??
        this.config.options?.frequencyPenalty,
      presence_penalty:
        input.options?.presencePenalty ?? this.config.options?.presencePenalty,
    });

    if (response.choices && response.choices.length > 0) {
      const content = response.choices[0].message.content;
      if (!content) {
        throw new Error('Empty response from LM Studio');
      }

      try {
        const parsed = JSON.parse(
          repairJson(content, { extractJson: true }) as string
        );
        return input.schema.parse(parsed) as T;
      } catch (parseErr) {
        throw new Error(`Error parsing JSON response from LM Studio: ${parseErr}`);
      }
    }

    throw new Error('No response from LM Studio');
  }
}

export default LMStudioLLM;
