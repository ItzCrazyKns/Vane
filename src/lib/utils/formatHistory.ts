import { BaseMessage, isAIMessage } from '@langchain/core/messages';

const formatChatHistoryAsString = (history: BaseMessage[]) => {
  return history
    .map(
      (message) =>
        `${isAIMessage(message) ? 'AI' : 'User'}: ${message.content}`,
    )
    .join('\n');
};

export default formatChatHistoryAsString;
