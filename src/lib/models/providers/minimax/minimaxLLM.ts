import OpenAILLM from '../openai/openaiLLM';
import { GenerateObjectInput, StreamTextOutput } from '../../types';
import { repairJson } from '@toolsycc/json-repair';

class MiniMaxLLM extends OpenAILLM {
  private stripThinkingTags(content: string): string {
    return content.replace(/<think>[\s\S]*?<\/think>/g, '').trim();
  }

  async generateObject<T>(input: GenerateObjectInput): Promise<T> {
    const response = await this.openAIClient.chat.completions.create({
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
    });

    if (response.choices && response.choices.length > 0) {
      try {
        let content = response.choices[0].message.content!;
        content = this.stripThinkingTags(content);

        return input.schema.parse(
          JSON.parse(
            repairJson(content, {
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

  async *streamText(
    input: import('../../types').GenerateTextInput,
  ): AsyncGenerator<StreamTextOutput> {
    const THINK_START = '<think>';
    const THINK_END = '</think>';
    let buffer = '';
    let insideThinkTag = false;

    for await (const chunk of super.streamText(input)) {
      buffer += chunk.contentChunk;

      let output = '';

      while (buffer.length > 0) {
        if (!insideThinkTag) {
          const thinkStart = buffer.indexOf(THINK_START);
          if (thinkStart === -1) {
            if (buffer.length >= THINK_START.length - 1) {
              const safeLength = buffer.length - (THINK_START.length - 1);
              output += buffer.slice(0, safeLength);
              buffer = buffer.slice(safeLength);
            }
            break;
          } else {
            output += buffer.slice(0, thinkStart);
            insideThinkTag = true;
            buffer = buffer.slice(thinkStart + THINK_START.length);
          }
        } else {
          const thinkEnd = buffer.indexOf(THINK_END);
          if (thinkEnd === -1) {
            if (buffer.length >= THINK_END.length - 1) {
              buffer = buffer.slice(-(THINK_END.length - 1));
            }
            break;
          } else {
            insideThinkTag = false;
            buffer = buffer.slice(thinkEnd + THINK_END.length);
          }
        }
      }

      const hasToolCalls = chunk.toolCallChunk && chunk.toolCallChunk.length > 0;
      if (output || chunk.done || hasToolCalls) {
        yield {
          contentChunk: output,
          toolCallChunk: chunk.toolCallChunk,
          done: chunk.done,
          additionalInfo: chunk.additionalInfo,
        };
      }
    }
  }
}

export default MiniMaxLLM;
