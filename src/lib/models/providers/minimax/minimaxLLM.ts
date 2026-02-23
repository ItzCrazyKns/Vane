import OpenAILLM from '../openai/openaiLLM';
import { zodResponseFormat } from 'openai/helpers/zod';
import { GenerateObjectInput } from '../../types';
import { repairJson } from '@toolsycc/json-repair';

/**
 * MinimaxLLM extends OpenAILLM to add MiniMax-specific handling.
 * 
 * MiniMax models (M2, M2.1, M2.5) support thinking/reasoning that gets
 * embedded in the content field as <thinking> tags when using the OpenAI-compatible
 * API. This breaks JSON parsing in generateObject() calls.
 * 
 * The fix is to add reasoning_split: true to the API call, which separates
 * thinking into a separate reasoning_details field.
 * 
 * See: https://platform.minimax.io/docs/api-reference/text-openai-api.md
 */
class MinimaxLLM extends OpenAILLM {
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
      // MiniMax-specific: split reasoning into separate field to prevent
      // <thinking> tags from breaking JSON parsing
      reasoning_split: true,
    });

    if (response.choices && response.choices.length > 0) {
      try {
        // Extract JSON from content - find first { and last }
        const content = response.choices[0].message.content || '';
        const startIndex = content.indexOf('{');
        const endIndex = content.lastIndexOf('}');
        let jsonStr = content;
        if (startIndex !== -1 && endIndex !== -1 && endIndex > startIndex) {
          jsonStr = content.substring(startIndex, endIndex + 1);
        }
        
        // Use repairJson to fix any issues
        const repaired = repairJson(jsonStr, { extractJson: true });
        if (!repaired) {
          throw new Error('No valid JSON found in response');
        }
        
        return input.schema.parse(
          JSON.parse(repaired as string),
        ) as T;
      } catch (err) {
        throw new Error(`Error parsing response from Minimax: ${err}`);
      }
    }

    throw new Error('No response from Minimax');
  }
}

export default MinimaxLLM;
