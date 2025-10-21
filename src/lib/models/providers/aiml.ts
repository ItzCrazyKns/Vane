import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { Model, ModelList, ProviderMetadata } from '../types';
import BaseModelProvider from './baseProvider';
import { ChatOpenAI, OpenAIEmbeddings } from '@langchain/openai';
import { Embeddings } from '@langchain/core/embeddings';
import { UIConfigField } from '@/lib/config/types';
import { getConfiguredModelProviderById } from '@/lib/config/serverRegistry';

interface AimlConfig {
  apiKey: string;
}

const providerConfigFields: UIConfigField[] = [
  {
    type: 'password',
    name: 'API Key',
    key: 'apiKey',
    description: 'Your AI/ML API key',
    required: true,
    placeholder: 'AI/ML API Key',
    env: 'AIML_API_KEY',
    scope: 'server',
  },
];

class AimlProvider extends BaseModelProvider<AimlConfig> {
  constructor(id: string, name: string, config: AimlConfig) {
    super(id, name, config);
  }

  async getDefaultModels(): Promise<ModelList> {
    try {
      const res = await fetch('https://api.aimlapi.com/models', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.config.apiKey}`,
        },
      });

      const data = await res.json();

      const chatModels: Model[] = data.data
        .filter((m: any) => m.type === 'chat-completion')
        .map((m: any) => {
          return {
            name: m.id,
            key: m.id,
          };
        });

      const embeddingModels: Model[] = data.data
        .filter((m: any) => m.type === 'embedding')
        .map((m: any) => {
          return {
            name: m.id,
            key: m.id,
          };
        });

      return {
        embedding: embeddingModels,
        chat: chatModels,
      };
    } catch (err) {
      if (err instanceof TypeError) {
        throw new Error(
          'Error connecting to AI/ML API. Please ensure your API key is correct and the service is available.',
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
        'Error Loading AI/ML API Chat Model. Invalid Model Selected',
      );
    }

    return new ChatOpenAI({
      apiKey: this.config.apiKey,
      temperature: 0.7,
      model: key,
      configuration: {
        baseURL: 'https://api.aimlapi.com',
      },
    });
  }

  async loadEmbeddingModel(key: string): Promise<Embeddings> {
    const modelList = await this.getModelList();
    const exists = modelList.embedding.find((m) => m.key === key);

    if (!exists) {
      throw new Error(
        'Error Loading AI/ML API Embedding Model. Invalid Model Selected.',
      );
    }

    return new OpenAIEmbeddings({
      apiKey: this.config.apiKey,
      model: key,
      configuration: {
        baseURL: 'https://api.aimlapi.com',
      },
    });
  }

  static parseAndValidate(raw: any): AimlConfig {
    if (!raw || typeof raw !== 'object')
      throw new Error('Invalid config provided. Expected object');
    if (!raw.apiKey)
      throw new Error('Invalid config provided. API key must be provided');

    return {
      apiKey: String(raw.apiKey),
    };
  }

  static getProviderConfigFields(): UIConfigField[] {
    return providerConfigFields;
  }

  static getProviderMetadata(): ProviderMetadata {
    return {
      key: 'aiml',
      name: 'AI/ML API',
    };
  }
}

export default AimlProvider;
