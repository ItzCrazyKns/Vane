import { ChatOpenAI, OpenAIEmbeddings } from '@langchain/openai';
import { getAimlApiKey } from '../config';
import { ChatModel, EmbeddingModel } from '.';
import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { Embeddings } from '@langchain/core/embeddings';
import axios from 'axios';

export const PROVIDER_INFO = {
  key: 'aimlapi',
  displayName: 'AI/ML API',
};

interface AimlApiModel {
  id: string;
  name?: string;
  type?: string;
}

const API_URL = 'https://api.aimlapi.com';

export const loadAimlApiChatModels = async () => {
  const apiKey = getAimlApiKey();

  if (!apiKey) return {};

  try {
    const response = await axios.get(`${API_URL}/models`, {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
    });

    const chatModels: Record<string, ChatModel> = {};

    response.data.data.forEach((model: AimlApiModel) => {
      if (model.type === 'chat-completion') {
        chatModels[model.id] = {
          displayName: model.name || model.id,
          model: new ChatOpenAI({
            apiKey: apiKey,
            modelName: model.id,
            temperature: 0.7,
            configuration: {
              baseURL: API_URL,
            },
          }) as unknown as BaseChatModel,
        };
      }
    });

    return chatModels;
  } catch (err) {
    console.error(`Error loading AI/ML API models: ${err}`);
    return {};
  }
};

export const loadAimlApiEmbeddingModels = async () => {
  const apiKey = getAimlApiKey();

  if (!apiKey) return {};

  try {
    const response = await axios.get(`${API_URL}/models`, {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
    });

    const embeddingModels: Record<string, EmbeddingModel> = {};

    response.data.data.forEach((model: AimlApiModel) => {
      if (model.type === 'embedding') {
        embeddingModels[model.id] = {
          displayName: model.name || model.id,
          model: new OpenAIEmbeddings({
            apiKey: apiKey,
            modelName: model.id,
            configuration: {
              baseURL: API_URL,
            },
          }) as unknown as Embeddings,
        };
      }
    });

    return embeddingModels;
  } catch (err) {
    console.error(`Error loading AI/ML API embeddings models: ${err}`);
    return {};
  }
};
