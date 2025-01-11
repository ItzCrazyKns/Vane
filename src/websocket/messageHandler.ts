import { EventEmitter, WebSocket } from 'ws';
import { BaseMessage, AIMessage, HumanMessage } from '@langchain/core/messages';
import type { BaseChatModel } from '@langchain/core/language_models/chat_models';
import type { Embeddings } from '@langchain/core/embeddings';
import logger from '../utils/logger';
import db from '../db';
import { chats, messages as messagesSchema } from '../db/schema';
import { eq, asc, gt, and } from 'drizzle-orm';
import crypto from 'crypto';
import { getFileDetails } from '../utils/files';
import MetaSearchAgent, {
  MetaSearchAgentType,
} from '../search/metaSearchAgent';
import prompts from '../prompts';

type Message = {
  messageId: string;
  chatId: string;
  content: string;
};

type WSMessage = {
  message: Message;
  optimizationMode: 'speed' | 'balanced' | 'quality';
  type: string;
  focusMode: string;
  history: Array<[string, string]>;
  files: Array<string>;
};

export const searchHandlers = {
  webSearch: new MetaSearchAgent({
    activeEngines: [],
    queryGeneratorPrompt: prompts.webSearchRetrieverPrompt,
    responsePrompt: prompts.webSearchResponsePrompt,
    rerank: true,
    rerankThreshold: 0.3,
    searchWeb: true,
    summarizer: true,
  }),
  academicSearch: new MetaSearchAgent({
    activeEngines: ['arxiv', 'google scholar', 'pubmed'],
    queryGeneratorPrompt: prompts.academicSearchRetrieverPrompt,
    responsePrompt: prompts.academicSearchResponsePrompt,
    rerank: true,
    rerankThreshold: 0,
    searchWeb: true,
    summarizer: false,
  }),
  writingAssistant: new MetaSearchAgent({
    activeEngines: [],
    queryGeneratorPrompt: '',
    responsePrompt: prompts.writingAssistantPrompt,
    rerank: true,
    rerankThreshold: 0,
    searchWeb: false,
    summarizer: false,
  }),
  wolframAlphaSearch: new MetaSearchAgent({
    activeEngines: ['wolframalpha'],
    queryGeneratorPrompt: prompts.wolframAlphaSearchRetrieverPrompt,
    responsePrompt: prompts.wolframAlphaSearchResponsePrompt,
    rerank: false,
    rerankThreshold: 0,
    searchWeb: true,
    summarizer: false,
  }),
  youtubeSearch: new MetaSearchAgent({
    activeEngines: ['youtube'],
    queryGeneratorPrompt: prompts.youtubeSearchRetrieverPrompt,
    responsePrompt: prompts.youtubeSearchResponsePrompt,
    rerank: true,
    rerankThreshold: 0.3,
    searchWeb: true,
    summarizer: false,
  }),
  redditSearch: new MetaSearchAgent({
    activeEngines: ['reddit'],
    queryGeneratorPrompt: prompts.redditSearchRetrieverPrompt,
    responsePrompt: prompts.redditSearchResponsePrompt,
    rerank: true,
    rerankThreshold: 0.3,
    searchWeb: true,
    summarizer: false,
  }),
};

const handleEmitterEvents = (
  emitter: EventEmitter,
  ws: WebSocket,
  messageId: string,
  chatId: string,
) => {
  let recievedMessage = '';
  let sources = [];

  emitter.on('data', (data) => {
    const parsedData = JSON.parse(data);
    if (parsedData.type === 'response') {
      ws.send(
        JSON.stringify({
          type: 'message',
          data: parsedData.data,
          messageId: messageId,
        }),
      );
      recievedMessage += parsedData.data;
    } else if (parsedData.type === 'sources') {
      ws.send(
        JSON.stringify({
          type: 'sources',
          data: parsedData.data,
          messageId: messageId,
        }),
      );
      sources = parsedData.data;
    }
  });
  emitter.on('end', () => {
    ws.send(JSON.stringify({ type: 'messageEnd', messageId: messageId }));

    db.insert(messagesSchema)
      .values({
        content: recievedMessage,
        chatId: chatId,
        messageId: messageId,
        role: 'assistant',
        metadata: JSON.stringify({
          createdAt: new Date(),
          ...(sources && sources.length > 0 && { sources }),
        }),
      })
      .execute();
  });
  emitter.on('error', (data) => {
    const parsedData = JSON.parse(data);
    ws.send(
      JSON.stringify({
        type: 'error',
        data: parsedData.data,
        key: 'CHAIN_ERROR',
      }),
    );
  });
};

export const handleMessage = async (
  message: string,
  ws: WebSocket,
  llm: BaseChatModel,
  embeddings: Embeddings,
) => {
  try {
    const parsedWSMessage = JSON.parse(message) as WSMessage;
    const parsedMessage = parsedWSMessage.message;

    if (parsedWSMessage.files.length > 0) {
      /* TODO: Implement uploads in other classes/single meta class system*/
      parsedWSMessage.focusMode = 'webSearch';
    }

    const humanMessageId =
      parsedMessage.messageId ?? crypto.randomBytes(7).toString('hex');
    const aiMessageId = crypto.randomBytes(7).toString('hex');

    if (!parsedMessage.content)
      return ws.send(
        JSON.stringify({
          type: 'error',
          data: 'Invalid message format',
          key: 'INVALID_FORMAT',
        }),
      );

    const history: BaseMessage[] = parsedWSMessage.history.map((msg) => {
      if (msg[0] === 'human') {
        return new HumanMessage({
          content: msg[1],
        });
      } else {
        return new AIMessage({
          content: msg[1],
        });
      }
    });

    if (parsedWSMessage.type === 'message') {
      const handler: MetaSearchAgentType =
        searchHandlers[parsedWSMessage.focusMode];

      if (handler) {
        try {
          const emitter = await handler.searchAndAnswer(
            parsedMessage.content,
            history,
            llm,
            embeddings,
            parsedWSMessage.optimizationMode,
            parsedWSMessage.files,
          );

          handleEmitterEvents(emitter, ws, aiMessageId, parsedMessage.chatId);

          const chat = await db.query.chats.findFirst({
            where: eq(chats.id, parsedMessage.chatId),
          });

          if (!chat) {
            await db
              .insert(chats)
              .values({
                id: parsedMessage.chatId,
                title: parsedMessage.content,
                createdAt: new Date().toString(),
                focusMode: parsedWSMessage.focusMode,
                files: parsedWSMessage.files.map(getFileDetails),
              })
              .execute();
          }

          const messageExists = await db.query.messages.findFirst({
            where: eq(messagesSchema.messageId, humanMessageId),
          });

          if (!messageExists) {
            await db
              .insert(messagesSchema)
              .values({
                content: parsedMessage.content,
                chatId: parsedMessage.chatId,
                messageId: humanMessageId,
                role: 'user',
                metadata: JSON.stringify({
                  createdAt: new Date(),
                }),
              })
              .execute();
          } else {
            await db
              .delete(messagesSchema)
              .where(
                and(
                  gt(messagesSchema.id, messageExists.id),
                  eq(messagesSchema.chatId, parsedMessage.chatId),
                ),
              )
              .execute();
          }
        } catch (err) {
          console.log(err);
        }
      } else {
        ws.send(
          JSON.stringify({
            type: 'error',
            data: 'Invalid focus mode',
            key: 'INVALID_FOCUS_MODE',
          }),
        );
      }
    }
  } catch (err) {
    ws.send(
      JSON.stringify({
        type: 'error',
        data: 'Invalid message format',
        key: 'INVALID_FORMAT',
      }),
    );
    logger.error(`Failed to handle message: ${err}`);
  }
};
