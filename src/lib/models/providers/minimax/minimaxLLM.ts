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

/**
 * Extract JSON from text by cleaning thinking/markdown and finding JSON boundaries
 */
function extractJSON(text: string): string {
  // 1. Remove all thinking blocks (including multiline content)
  let cleanedText = text.replace(/<minimax:[a-zA-Z0-9_-]+>[\s\S]*?<\/minimax:[a-zA-Z0-9_-]+>/gi, '');
  cleanedText = cleanedText.replace(/<think>[\s\S]*?<\/think>/gi, '');
  
  // 2. Remove ONLY the markdown wrappers, not the content inside them!
  cleanedText = cleanedText.replace(/```json/gi, '');
  cleanedText = cleanedText.replace(/```/g, '');
  
  // 3. Find the boundaries of the actual JSON object
  const startIndex = cleanedText.indexOf('{');
  const endIndex = cleanedText.lastIndexOf('}');
  
  // 4. Extract and return only the JSON payload
  if (startIndex !== -1 && endIndex !== -1 && endIndex >= startIndex) {
    return cleanedText.substring(startIndex, endIndex + 1);
  }
  
  // Fallback
  return text;
}

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
        const content = response.choices[0].message.content || '';
        const jsonStr = extractJSON(content);
        
        // Use repairJson as safety net
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
