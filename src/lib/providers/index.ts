import { loadGroqChatModels } from './groq';
import { loadOllamaChatModels } from './ollama';
import { loadOpenAIChatModels, loadOpenAIEmbeddingsModel } from './openai';
import { loadTransformersEmbeddingsModel } from './transformers';

const chatModelProviders = {
  openai: loadOpenAIChatModels,
  groq: loadGroqChatModels,
  ollama: loadOllamaChatModels,
};

const embeddingModelProviders = {
  openai: loadOpenAIEmbeddingsModel,
  local: loadTransformersEmbeddingsModel,
  ollama: loadOllamaChatModels,
};

export const getAvailableChatModelProviders = async () => {
  const models = {};

  for (const provider in chatModelProviders) {
    models[provider] = await chatModelProviders[provider]();
  }

  models['custom_openai'] = {}

  return models;
};

export const getAvailableEmbeddingModelProviders = async () => {
  const models = {};

  for (const provider in embeddingModelProviders) {
    models[provider] = await embeddingModelProviders[provider]();
  }

  return models;
};
