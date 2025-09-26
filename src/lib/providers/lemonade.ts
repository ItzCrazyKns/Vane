import axios from 'axios';
import { getLemonadeApiEndpoint, getLemonadeApiKey } from '../config';
import { ChatModel, EmbeddingModel } from '.';

export const PROVIDER_INFO = {
  key: 'lemonade',
  displayName: 'Lemonade',
};

import { ChatOpenAI } from '@langchain/openai';
import { OpenAIEmbeddings } from '@langchain/openai';

export const loadLemonadeChatModels = async () => {
  const lemonadeApiEndpoint = getLemonadeApiEndpoint();
  const lemonadeApiKey = getLemonadeApiKey();

  if (!lemonadeApiEndpoint) return {};

  try {
    const res = await axios.get(`${lemonadeApiEndpoint}/api/v1/models`, {
      headers: {
        'Content-Type': 'application/json',
        ...(lemonadeApiKey
          ? { Authorization: `Bearer ${lemonadeApiKey}` }
          : {}),
      },
    });

    const { data: models } = res.data;

    const chatModels: Record<string, ChatModel> = {};

    models.forEach((model: any) => {
      chatModels[model.id] = {
        displayName: model.id,
        model: new ChatOpenAI({
          apiKey: lemonadeApiKey || 'lemonade-key',
          modelName: model.id,
          temperature: 0.7,
          configuration: {
            baseURL: `${lemonadeApiEndpoint}/api/v1`,
          },
        }),
      };
    });

    return chatModels;
  } catch (err) {
    console.error(`Error loading Lemonade models: ${err}`);
    return {};
  }
};

export const loadLemonadeEmbeddingModels = async () => {
  const lemonadeApiEndpoint = getLemonadeApiEndpoint();
  const lemonadeApiKey = getLemonadeApiKey();

  if (!lemonadeApiEndpoint) return {};

  try {
    const res = await axios.get(`${lemonadeApiEndpoint}/api/v1/models`, {
      headers: {
        'Content-Type': 'application/json',
        ...(lemonadeApiKey
          ? { Authorization: `Bearer ${lemonadeApiKey}` }
          : {}),
      },
    });

    const { data: models } = res.data;

    const embeddingModels: Record<string, EmbeddingModel> = {};

    // Filter models that support embeddings (if Lemonade provides this info)
    // For now, we'll assume all models can be used for embeddings
    models.forEach((model: any) => {
      embeddingModels[model.id] = {
        displayName: model.id,
        model: new OpenAIEmbeddings({
          apiKey: lemonadeApiKey || 'lemonade-key',
          modelName: model.id,
          configuration: {
            baseURL: `${lemonadeApiEndpoint}/api/v1`,
          },
        }),
      };
    });

    return embeddingModels;
  } catch (err) {
    console.error(`Error loading Lemonade embedding models: ${err}`);
    return {};
  }
};
