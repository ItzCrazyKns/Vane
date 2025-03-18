import { BaseMessage } from '@langchain/core/messages';

const formatChatHistoryAsString = (history: BaseMessage[]) => {
  return history
    .map((message) => `${message._getType()}: ${message.content}`)
    .join('\n');
};

export default formatChatHistoryAsString;
