import { ChatOpenAI, OpenAIEmbeddings } from '@langchain/openai';
import { getGeminiApiKey } from '../config';
import { ChatModel, EmbeddingModel } from '.';
import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { Embeddings } from '@langchain/core/embeddings';

const geminiChatModels: Record<string, string>[] = [
  {
    displayName: 'Gemini 2.0 Flash',
    key: 'gemini-2.0-flash',
  },
  {
    displayName: 'Gemini 2.0 Flash-Lite',
    key: 'gemini-2.0-flash-lite',
  },
  {
    displayName: 'Gemini 2.0 Pro Experimental',
    key: 'gemini-2.0-pro-exp-02-05',
  },
  {
    displayName: 'Gemini 1.5 Flash',
    key: 'gemini-1.5-flash',
  },
  {
    displayName: 'Gemini 1.5 Flash-8B',
    key: 'gemini-1.5-flash-8b',
  },
  {
    displayName: 'Gemini 1.5 Pro',
    key: 'gemini-1.5-pro',
  },
];

const geminiEmbeddingModels: Record<string, string>[] = [
  {
    displayName: 'Gemini Embedding',
    key: 'gemini-embedding-exp',
  },
];

export const loadGeminiChatModels = async () => {
  const geminiApiKey = getGeminiApiKey();

  if (!geminiApiKey) return {};

  try {
    const chatModels: Record<string, ChatModel> = {};

    geminiChatModels.forEach((model) => {
      chatModels[model.key] = {
        displayName: model.displayName,
        model: new ChatOpenAI({
          openAIApiKey: geminiApiKey,
          modelName: model.key,
          temperature: 0.7,
          configuration: {
            baseURL: 'https://generativelanguage.googleapis.com/v1beta/openai/',
          },
        }) as unknown as BaseChatModel,
      };
    });

    return chatModels;
  } catch (err) {
    console.error(`Error loading Gemini models: ${err}`);
    return {};
  }
};

export const loadGeminiEmbeddingModels = async () => {
  const geminiApiKey = getGeminiApiKey();

  if (!geminiApiKey) return {};

  try {
    const embeddingModels: Record<string, EmbeddingModel> = {};

    geminiEmbeddingModels.forEach((model) => {
      embeddingModels[model.key] = {
        displayName: model.displayName,
        model: new OpenAIEmbeddings({
          openAIApiKey: geminiApiKey,
          modelName: model.key,
          configuration: {
            baseURL: 'https://generativelanguage.googleapis.com/v1beta/openai/',
          },
        }) as unknown as Embeddings,
      };
    });

    return embeddingModels;
  } catch (err) {
    console.error(`Error loading OpenAI embeddings models: ${err}`);
    return {};
  }
};
