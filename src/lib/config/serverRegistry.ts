import configManager from './index';
import { ConfigModelProvider } from './types';
import { Model, ModelList } from '../models/types';

export const getConfiguredModelProviders = (): ConfigModelProvider[] => {
  return configManager.getConfig('modelProviders', []);
};

export const getConfiguredModelProviderById = (
  id: string,
): ConfigModelProvider | undefined => {
  return getConfiguredModelProviders().find((p) => p.id === id) ?? undefined;
};

export const getSearxngURL = () =>
  configManager.getConfig('search.searxngURL', '');

/**
 * Merges discovered models with user-configured models, filtering out excluded models.
 * Use this in provider getModelList() implementations.
 */
export const mergeModelsWithExclusions = (
  discoveredModels: ModelList,
  configProvider: ConfigModelProvider,
): ModelList => {
  const excludedChat = configProvider.excludedChatModels ?? [];
  const excludedEmbedding = configProvider.excludedEmbeddingModels ?? [];

  return {
    chat: [
      ...discoveredModels.chat.filter((m) => !excludedChat.includes(m.key)),
      ...configProvider.chatModels,
    ],
    embedding: [
      ...discoveredModels.embedding.filter(
        (m) => !excludedEmbedding.includes(m.key),
      ),
      ...configProvider.embeddingModels,
    ],
  };
};
