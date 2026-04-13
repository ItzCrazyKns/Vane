import { ChatTurnMessage } from '../types';

const formatChatHistoryAsString = (history: ChatTurnMessage[]) => {
  return history
    .map(
      (message) =>
        `${message.role === 'assistant' ? 'AI' : 'User'}: ${message.content ?? ''}`,
    )
    .join('\n');
};

export default formatChatHistoryAsString;
