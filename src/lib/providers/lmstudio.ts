import { getKeepAlive, getLMStudioApiEndpoint } from '../config';
import axios from 'axios';
import { ChatModel, EmbeddingModel } from '.';

export const PROVIDER_INFO = {
  key: 'lmstudio',
  displayName: 'LM Studio',
};
import { ChatOpenAI } from '@langchain/openai';
import { OpenAIEmbeddings } from '@langchain/openai';
import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { Embeddings } from '@langchain/core/embeddings';

interface LMStudioModel {
  id: string;
  name?: string;
}

const ensureV1Endpoint = (endpoint: string): string =>
  endpoint.endsWith('/v1') ? endpoint : `${endpoint}/v1`;

const checkServerAvailability = async (endpoint: string): Promise<boolean> => {
  try {
    await axios.get(`${ensureV1Endpoint(endpoint)}/models`, {
      headers: { 'Content-Type': 'application/json' },
    });
    return true;
  } catch {
    return false;
  }
};

export const loadLMStudioChatModels = async () => {
  const endpoint = getLMStudioApiEndpoint();

  if (!endpoint) return {};
  if (!(await checkServerAvailability(endpoint))) return {};

  try {
    const response = await axios.get(`${ensureV1Endpoint(endpoint)}/models`, {
      headers: { 'Content-Type': 'application/json' },
    });

    const chatModels: Record<string, ChatModel> = {};

    response.data.data.forEach((model: LMStudioModel) => {
      chatModels[model.id] = {
        displayName: model.name || model.id,
        model: new ChatOpenAI({
          openAIApiKey: 'lm-studio',
          configuration: {
            baseURL: ensureV1Endpoint(endpoint),
          },
          modelName: model.id,
          temperature: 0.7,
          streaming: true,
          maxRetries: 3,
        }) as unknown as BaseChatModel,
      };
    });

    return chatModels;
  } catch (err) {
    console.error(`Error loading LM Studio models: ${err}`);
    return {};
  }
};

export const loadLMStudioEmbeddingsModels = async () => {
  const endpoint = getLMStudioApiEndpoint();

  if (!endpoint) return {};
  if (!(await checkServerAvailability(endpoint))) return {};

  try {
    const response = await axios.get(`${ensureV1Endpoint(endpoint)}/models`, {
      headers: { 'Content-Type': 'application/json' },
    });

    const embeddingsModels: Record<string, EmbeddingModel> = {};

    response.data.data.forEach((model: LMStudioModel) => {
      embeddingsModels[model.id] = {
        displayName: model.name || model.id,
        model: new OpenAIEmbeddings({
          openAIApiKey: 'lm-studio',
          configuration: {
            baseURL: ensureV1Endpoint(endpoint),
          },
          modelName: model.id,
        }) as unknown as Embeddings,
      };
    });

    return embeddingsModels;
  } catch (err) {
    console.error(`Error loading LM Studio embeddings model: ${err}`);
    return {};
  }
};
