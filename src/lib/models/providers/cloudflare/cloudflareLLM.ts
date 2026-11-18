import z from 'zod';
import { repairJson } from '@toolsycc/json-repair';
import OpenAILLM from '../openai/openaiLLM';
import { GenerateObjectInput } from '../../types';

class CloudflareLLM extends OpenAILLM {
  async generateObject<T>(input: GenerateObjectInput): Promise<T> {
    try {
      return await super.generateObject<T>(input);
    } catch {
      /*
       * Workers AI only supports JSON mode on some models. For the rest, retry
       * as a normal chat completion with the schema in the prompt and parse the
       * JSON out of the response.
       */
      try {
        const response = await this.openAIClient.chat.completions.create({
          model: this.config.model,
          messages: [
            {
              role: 'system',
              content: `Respond with only a valid JSON object that matches this JSON schema. Do not include markdown fences, comments, or any text outside the JSON object.\n\nJSON schema:\n${JSON.stringify(
                z.toJSONSchema(input.schema),
              )}`,
            },
            ...this.convertToOpenAIMessages(input.messages),
          ],
          temperature:
            input.options?.temperature ??
            this.config.options?.temperature ??
            1.0,
          top_p: input.options?.topP ?? this.config.options?.topP,
          max_tokens:
            input.options?.maxTokens ?? this.config.options?.maxTokens,
          stop:
            input.options?.stopSequences ?? this.config.options?.stopSequences,
          frequency_penalty:
            input.options?.frequencyPenalty ??
            this.config.options?.frequencyPenalty,
          presence_penalty:
            input.options?.presencePenalty ??
            this.config.options?.presencePenalty,
        });

        const content = response.choices?.[0]?.message?.content;

        if (!content) {
          throw new Error('No response from Cloudflare Workers AI');
        }

        return input.schema.parse(
          JSON.parse(
            repairJson(content, {
              extractJson: true,
            }) as string,
          ),
        ) as T;
      } catch (fallbackError) {
        throw new Error(
          `Error generating object with Cloudflare Workers AI: ${
            fallbackError instanceof Error
              ? fallbackError.message
              : String(fallbackError)
          }`,
        );
      }
    }
  }
}

export default CloudflareLLM;
