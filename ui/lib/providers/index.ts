import { Embeddings } from '@langchain/core/embeddings';
import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { loadOpenAIChatModels, loadOpenAIEmbeddingModels } from './openai';
import { getCustomOpenaiApiKey, getCustomOpenaiApiUrl, getCustomOpenaiModelName } from '../config';
import { ChatOpenAI } from '@langchain/openai';

export interface ChatModelProvider {
    displayName: string
    model: BaseChatModel
}

export interface EmbeddingModelProvider {
    displayName: string
    model: Embeddings
}

const chatModelProviders: Record<string, () => Promise<Record<string, ChatModelProvider>>> = {
    openai: loadOpenAIChatModels
}

const embeddingModelProviders: Record<string, () => Promise<Record<string, EmbeddingModelProvider>>> = {
    openai: loadOpenAIEmbeddingModels
}

export const getAvailableChatModelProviders = async () => {
    const models: Record<string, Record<string, ChatModelProvider>> = {};
  
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
    const models: Record<string, Record<string, EmbeddingModelProvider>> = {};
  
    for (const provider in embeddingModelProviders) {
      const providerModels = await embeddingModelProviders[provider]();
      if (Object.keys(providerModels).length > 0) {
        models[provider] = providerModels;
      }
    }
  
    return models;
  };
  