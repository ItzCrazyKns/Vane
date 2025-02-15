import { loadGroqChatModels } from './groq';
import { loadOllamaChatModels, loadOllamaEmbeddingsModels } from './ollama';
import { loadOpenAIChatModels, loadOpenAIEmbeddingsModels } from './openai';
import { loadAnthropicChatModels } from './anthropic';
import { loadTransformersEmbeddingsModels } from './transformers';
import { loadGeminiChatModels, loadGeminiEmbeddingsModels } from './gemini';
import {
  getCustomOpenaiApiKey,
  getCustomOpenaiApiUrl,
  getCustomOpenaiModelName,
} from '../../config';
import { ChatOpenAI } from '@langchain/openai';

const chatModelProviders = {
  openai: loadOpenAIChatModels,
  groq: loadGroqChatModels,
  ollama: loadOllamaChatModels,
  anthropic: loadAnthropicChatModels,
  gemini: loadGeminiChatModels,
};

const embeddingModelProviders = {
  openai: loadOpenAIEmbeddingsModels,
  local: loadTransformersEmbeddingsModels,
  ollama: loadOllamaEmbeddingsModels,
  gemini: loadGeminiEmbeddingsModels,
};

export const getAvailableChatModelProviders = async () => {
  const models = {};

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
            }),
          },
        }
      : {}),
  };

  return models;
};

export const getAvailableEmbeddingModelProviders = async () => {
  const models = {};

  for (const provider in embeddingModelProviders) {
    const providerModels = await embeddingModelProviders[provider]();
    if (Object.keys(providerModels).length > 0) {
      models[provider] = providerModels;
    }
  }

  return models;
};
