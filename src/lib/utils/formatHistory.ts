import { ChatTurnMessage } from '../types';

const getTextContent = (content: string | { type: string; text?: string }[]): string => {
  if (typeof content === 'string') return content;
  return content
    .filter((part) => part.type === 'text')
    .map((part) => part.text ?? '')
    .join('\n');
};

const formatChatHistoryAsString = (history: ChatTurnMessage[]) => {
  return history
    .map(
      (message) =>
        `${message.role === 'assistant' ? 'AI' : 'User'}: ${getTextContent(message.content)}`,
    )
    .join('\n');
};

export default formatChatHistoryAsString;
