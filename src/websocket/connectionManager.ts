import { WebSocket } from 'ws';
import { handleMessage } from './messageHandler';
import { ChatOpenAI, OpenAIEmbeddings } from '@langchain/openai';
import { getOpenaiApiKey } from '../config';

export const handleConnection = (ws: WebSocket) => {
  const llm = new ChatOpenAI({
    temperature: 0.7,
    openAIApiKey: getOpenaiApiKey(),
  });

  const embeddings = new OpenAIEmbeddings({
    openAIApiKey: getOpenaiApiKey(),
    modelName: 'text-embedding-3-large',
  });

  ws.on(
    'message',
    async (message) =>
      await handleMessage(message.toString(), ws, llm, embeddings),
  );

  ws.on('close', () => console.log('Connection closed'));
};
