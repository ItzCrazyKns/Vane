import { WebSocket } from 'ws';
import { handleMessage } from './messageHandler';
import { getAvailableProviders } from '../lib/providers';
import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import type { Embeddings } from '@langchain/core/embeddings';
import type { IncomingMessage } from 'http';
import logger from '../utils/logger';

export const handleConnection = async (
  ws: WebSocket,
  request: IncomingMessage,
) => {
  const searchParams = new URL(request.url, `http://${request.headers.host}`)
    .searchParams;

  const models = await getAvailableProviders();
  const provider =
    searchParams.get('chatModelProvider') || Object.keys(models)[0];
  const chatModel =
    searchParams.get('chatModel') || Object.keys(models[provider])[0];

  let llm: BaseChatModel | undefined;
  let embeddings: Embeddings | undefined;

  if (models[provider] && models[provider][chatModel]) {
    llm = models[provider][chatModel] as BaseChatModel | undefined;
    embeddings = models[provider].embeddings as Embeddings | undefined;
  }

  if (!llm || !embeddings) {
    ws.send(
      JSON.stringify({
        type: 'error',
        data: 'Invalid LLM or embeddings model selected',
      }),
    );
    ws.close();
  }

  ws.on(
    'message',
    async (message) =>
      await handleMessage(message.toString(), ws, llm, embeddings),
  );

  ws.on('close', () => logger.debug('Connection closed'));
};
