import { Embeddings } from '@langchain/core/embeddings';
import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import {
  loadOpenAIChatModels,
  loadOpenAIEmbeddingModels,
  PROVIDER_INFO as OpenAIInfo,
  PROVIDER_INFO,
} from './openai';
import {
  getCustomOpenaiApiKey,
  getCustomOpenaiApiUrl,
  getCustomOpenaiModelName,
} from '../config';
import { ChatOpenAI } from '@langchain/openai';
import {
  loadOllamaChatModels,
  loadOllamaEmbeddingModels,
  PROVIDER_INFO as OllamaInfo,
} from './ollama';
import { loadGroqChatModels, PROVIDER_INFO as GroqInfo } from './groq';
import {
  loadAnthropicChatModels,
  PROVIDER_INFO as AnthropicInfo,
} from './anthropic';
import {
  loadGeminiChatModels,
  loadGeminiEmbeddingModels,
  PROVIDER_INFO as GeminiInfo,
} from './gemini';
import {
  loadTransformersEmbeddingsModels,
  PROVIDER_INFO as TransformersInfo,
} from './transformers';
import {
  loadDeepseekChatModels,
  PROVIDER_INFO as DeepseekInfo,
} from './deepseek';
import {
  loadLMStudioChatModels,
  loadLMStudioEmbeddingsModels,
  PROVIDER_INFO as LMStudioInfo,
} from './lmstudio';

export const PROVIDER_METADATA = {
  openai: OpenAIInfo,
  ollama: OllamaInfo,
  groq: GroqInfo,
  anthropic: AnthropicInfo,
  gemini: GeminiInfo,
  transformers: TransformersInfo,
  deepseek: DeepseekInfo,
  lmstudio: LMStudioInfo,
  custom_openai: {
    key: 'custom_openai',
    displayName: 'Custom OpenAI',
  },
};

export interface ChatModel {
  displayName: string;
  model: BaseChatModel;
}

export interface EmbeddingModel {
  displayName: string;
  model: Embeddings;
}

export const chatModelProviders: Record<
  string,
  () => Promise<Record<string, ChatModel>>
> = {
  openai: loadOpenAIChatModels,
  ollama: loadOllamaChatModels,
  groq: loadGroqChatModels,
  anthropic: loadAnthropicChatModels,
  gemini: loadGeminiChatModels,
  deepseek: loadDeepseekChatModels,
  lmstudio: loadLMStudioChatModels,
};

export const embeddingModelProviders: Record<
  string,
  () => Promise<Record<string, EmbeddingModel>>
> = {
  openai: loadOpenAIEmbeddingModels,
  ollama: loadOllamaEmbeddingModels,
  gemini: loadGeminiEmbeddingModels,
  transformers: loadTransformersEmbeddingsModels,
  lmstudio: loadLMStudioEmbeddingsModels,
};

export const getAvailableChatModelProviders = async () => {
  const models: Record<string, Record<string, ChatModel>> = {};

  for (const provider in chatModelProviders) {
    const providerModels = await chatModelProviders[provider]();
    if (Object.keys(providerModels).length > 0) {
      models[provider] = providerModels;
    }
  }

  const customOpenAiApiKey = getCustomOpenaiApiKey();
  const customOpenAiApiUrl = getCustomOpenaiApiUrl();
  const customOpenAiModelName = getCustomOpenaiModelName();

  models['custom_openai'] = {
    ...(customOpenAiApiKey && customOpenAiApiUrl && customOpenAiModelName
      ? {
          [customOpenAiModelName]: {
            displayName: customOpenAiModelName,
            model: new ChatOpenAI({
              openAIApiKey: customOpenAiApiKey,
              modelName: customOpenAiModelName,
              temperature: 0.7,
              configuration: {
                baseURL: customOpenAiApiUrl,
              },
            }) as unknown as BaseChatModel,
          },
        }
      : {}),
  };

  return models;
};

export const getAvailableEmbeddingModelProviders = async () => {
  const models: Record<string, Record<string, EmbeddingModel>> = {};

  for (const provider in embeddingModelProviders) {
    const providerModels = await embeddingModelProviders[provider]();
    if (Object.keys(providerModels).length > 0) {
      models[provider] = providerModels;
    }
  }

  return models;
};
