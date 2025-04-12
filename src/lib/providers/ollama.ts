import axios from 'axios';
import { getKeepAlive, getOllamaApiEndpoint } from '../config';
import { ChatModel, EmbeddingModel } from '.';

export const PROVIDER_INFO = {
  key: 'ollama',
  displayName: 'Ollama',
};
import { ChatOllama } from '@langchain/community/chat_models/ollama';
import { OllamaEmbeddings } from '@langchain/community/embeddings/ollama';

export const loadOllamaChatModels = async () => {
  const ollamaApiEndpoint = getOllamaApiEndpoint();

  if (!ollamaApiEndpoint) return {};

  try {
    const res = await axios.get(`${ollamaApiEndpoint}/api/tags`, {
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const { models } = res.data;

    const chatModels: Record<string, ChatModel> = {};

    models.forEach((model: any) => {
      chatModels[model.model] = {
        displayName: model.name,
        model: new ChatOllama({
          baseUrl: ollamaApiEndpoint,
          model: model.model,
          temperature: 0.7,
          keepAlive: getKeepAlive(),
        }),
      };
    });

    return chatModels;
  } catch (err) {
    console.error(`Error loading Ollama models: ${err}`);
    return {};
  }
};

export const loadOllamaEmbeddingModels = async () => {
  const ollamaApiEndpoint = getOllamaApiEndpoint();

  if (!ollamaApiEndpoint) return {};

  try {
    const res = await axios.get(`${ollamaApiEndpoint}/api/tags`, {
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const { models } = res.data;

    const embeddingModels: Record<string, EmbeddingModel> = {};

    models.forEach((model: any) => {
      embeddingModels[model.model] = {
        displayName: model.name,
        model: new OllamaEmbeddings({
          baseUrl: ollamaApiEndpoint,
          model: model.model,
        }),
      };
    });

    return embeddingModels;
  } catch (err) {
    console.error(`Error loading Ollama embeddings models: ${err}`);
    return {};
  }
};
