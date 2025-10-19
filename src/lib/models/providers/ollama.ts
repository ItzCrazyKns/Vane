import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { Model, ModelList, ProviderMetadata } from '../types';
import BaseModelProvider from './baseProvider';
import { ChatOllama, OllamaEmbeddings } from '@langchain/ollama';
import { Embeddings } from '@langchain/core/embeddings';
import { UIConfigField } from '@/lib/config/types';
import { getConfiguredModelProviderById } from '@/lib/config/serverRegistry';

interface OllamaConfig {
  baseURL: string;
}

const providerConfigFields: UIConfigField[] = [
  {
    type: 'string',
    name: 'Base URL',
    key: 'baseURL',
    description: 'The base URL for the Ollama',
    required: true,
    placeholder: process.env.DOCKER
      ? 'http://host.docker.internal:11434'
      : 'http://localhost:11434',
    env: 'OLLAMA_BASE_URL',
    scope: 'server',
  },
];

class OllamaProvider extends BaseModelProvider<OllamaConfig> {
  constructor(id: string, name: string, config: OllamaConfig) {
    super(id, name, config);
  }

  async getDefaultModels(): Promise<ModelList> {
    try {
      const res = await fetch(`${this.config.baseURL}/api/tags`, {
        method: 'GET',
        headers: {
          'Content-type': 'application/json',
        },
      });

      const data = await res.json();

      const models: Model[] = data.models.map((m: any) => {
        return {
          name: m.name,
          key: m.model,
        };
      });

      return {
        embedding: models,
        chat: models,
      };
    } catch (err) {
      if (err instanceof TypeError) {
        throw new Error(
          'Error connecting to Ollama API. Please ensure the base URL is correct and the Ollama server is running.',
        );
      }

      throw err;
    }
  }

  async getModelList(): Promise<ModelList> {
    const defaultModels = await this.getDefaultModels();
    const configProvider = getConfiguredModelProviderById(this.id)!;

    return {
      embedding: [
        ...defaultModels.embedding,
        ...configProvider.embeddingModels,
      ],
      chat: [...defaultModels.chat, ...configProvider.chatModels],
    };
  }

  async loadChatModel(key: string): Promise<BaseChatModel> {
    const modelList = await this.getModelList();

    const exists = modelList.chat.find((m) => m.key === key);

    if (!exists) {
      throw new Error(
        'Error Loading Ollama Chat Model. Invalid Model Selected',
      );
    }

    return new ChatOllama({
      temperature: 0.7,
      model: key,
      baseUrl: this.config.baseURL,
    });
  }

  async loadEmbeddingModel(key: string): Promise<Embeddings> {
    const modelList = await this.getModelList();
    const exists = modelList.embedding.find((m) => m.key === key);

    if (!exists) {
      throw new Error(
        'Error Loading Ollama Embedding Model. Invalid Model Selected.',
      );
    }

    return new OllamaEmbeddings({
      model: key,
      baseUrl: this.config.baseURL,
    });
  }

  static parseAndValidate(raw: any): OllamaConfig {
    if (!raw || typeof raw !== 'object')
      throw new Error('Invalid config provided. Expected object');
    if (!raw.baseURL)
      throw new Error('Invalid config provided. Base URL must be provided');

    return {
      baseURL: String(raw.baseURL),
    };
  }

  static getProviderConfigFields(): UIConfigField[] {
    return providerConfigFields;
  }

  static getProviderMetadata(): ProviderMetadata {
    return {
      key: 'ollama',
      name: 'Ollama',
    };
  }
}

export default OllamaProvider;
