import OpenAILLM from '../openai/openaiLLM';
import {
  GenerateTextInput,
  GenerateTextOutput,
  StreamTextOutput,
} from '../../types';

class MiniMaxLLM extends OpenAILLM {
  private preservedContent = new Map<string, string>();

  private withPreservedContent(input: GenerateTextInput): GenerateTextInput {
    return {
      ...input,
      messages: input.messages.map((message) => {
        if (
          message.role !== 'assistant' ||
          message.content ||
          !message.tool_calls?.length
        ) {
          return message;
        }

        const content = message.tool_calls
          .map((toolCall) => this.preservedContent.get(toolCall.id))
          .find((preservedContent) => preservedContent !== undefined);
        return content ? { ...message, content } : message;
      }),
    };
  }

  private rememberContent(toolCallIds: string[], content: string): void {
    if (!content || toolCallIds.length === 0) {
      return;
    }

    toolCallIds.forEach((id) => this.preservedContent.set(id, content));

    while (this.preservedContent.size > 100) {
      const oldestKey = this.preservedContent.keys().next().value;

      if (!oldestKey) {
        break;
      }

      this.preservedContent.delete(oldestKey);
    }
  }

  async generateText(input: GenerateTextInput): Promise<GenerateTextOutput> {
    const response = await super.generateText(this.withPreservedContent(input));

    this.rememberContent(
      response.toolCalls.map((toolCall) => toolCall.id),
      response.content,
    );

    return response;
  }

  async *streamText(
    input: GenerateTextInput,
  ): AsyncGenerator<StreamTextOutput> {
    let content = '';
    const toolCallIds = new Set<string>();

    for await (const chunk of super.streamText(
      this.withPreservedContent(input),
    )) {
      content += chunk.contentChunk;
      chunk.toolCallChunk.forEach((toolCall) => toolCallIds.add(toolCall.id));
      yield chunk;
    }

    this.rememberContent([...toolCallIds], content);
  }
}

export default MiniMaxLLM;
