import {
  ChatGoogleGenerativeAI,
  GoogleGenerativeAIEmbeddings,
} from '@langchain/google-genai';
import { getGeminiApiKey } from '../../config';
import logger from '../../utils/logger';

export const loadGeminiChatModels = async () => {
  const geminiApiKey = getGeminiApiKey();

  if (!geminiApiKey) return {};

  try {
    const chatModels = {
      'gemini-1.5-flash': {
        displayName: 'Gemini 1.5 Flash',
        model: new ChatGoogleGenerativeAI({
          modelName: 'gemini-1.5-flash',
          temperature: 0.7,
          apiKey: geminiApiKey,
        }),
      },
      'gemini-1.5-flash-8b': {
        displayName: 'Gemini 1.5 Flash 8B',
        model: new ChatGoogleGenerativeAI({
          modelName: 'gemini-1.5-flash-8b',
          temperature: 0.7,
          apiKey: geminiApiKey,
        }),
      },
      'gemini-1.5-pro': {
        displayName: 'Gemini 1.5 Pro',
        model: new ChatGoogleGenerativeAI({
          modelName: 'gemini-1.5-pro',
          temperature: 0.7,
          apiKey: geminiApiKey,
        }),
      },
    };

    return chatModels;
  } catch (err) {
    logger.error(`Error loading Gemini models: ${err}`);
    return {};
  }
};

export const loadGeminiEmbeddingsModels = async () => {
  const geminiApiKey = getGeminiApiKey();

  if (!geminiApiKey) return {};

  try {
    const embeddingModels = {
      'text-embedding-004': {
        displayName: 'Text Embedding',
        model: new GoogleGenerativeAIEmbeddings({
          apiKey: geminiApiKey,
          modelName: 'text-embedding-004',
        }),
      },
    };

    return embeddingModels;
  } catch (err) {
    logger.error(`Error loading Gemini embeddings model: ${err}`);
    return {};
  }
};
