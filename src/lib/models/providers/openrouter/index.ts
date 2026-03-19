import { UIConfigField } from '@/lib/config/types';
import { getConfiguredModelProviderById } from '@/lib/config/serverRegistry';
import { Model, ModelList, ProviderMetadata } from '../../types';
import OpenRouterLLM from './openrouterLLM';
import OpenRouterEmbedding from './openrouterEmbedding';
import BaseEmbedding from '../../base/embedding';
import BaseModelProvider from '../../base/provider';
import BaseLLM from '../../base/llm';

interface OpenRouterConfig {
  apiKey: string;
}

const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1';

const providerConfigFields: UIConfigField[] = [
  {
    type: 'password',
    name: 'API Key',
    key: 'apiKey',
    description: 'Your OpenRouter API key',
    required: true,
    placeholder: 'OpenRouter API Key',
    env: 'OPENROUTER_API_KEY',
    scope: 'server',
  },
];

class OpenRouterProvider extends BaseModelProvider<OpenRouterConfig> {
  constructor(id: string, name: string, config: OpenRouterConfig) {
    super(id, name, config);
  }

  async getDefaultModels(): Promise<ModelList> {
    try {
      const [chatRes, embedRes] = await Promise.all([
        fetch(`${OPENROUTER_BASE_URL}/models`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            ...(this.config.apiKey
              ? { Authorization: `Bearer ${this.config.apiKey}` }
              : {}),
          },
        }),
        fetch(`${OPENROUTER_BASE_URL}/embeddings/models`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            ...(this.config.apiKey
              ? { Authorization: `Bearer ${this.config.apiKey}` }
              : {}),
          },
        }),
      ]);

      let chatModels: Model[] = [];
      let embeddingModels: Model[] = [];

      if (chatRes.ok) {
        const chatData = await chatRes.json();
        if (chatData.data && Array.isArray(chatData.data)) {
          chatModels = chatData.data.map((m: any) => ({
            key: m.id,
            name: m.name || m.id,
          }));
        }
      }

      if (embedRes.ok) {
        const embedData = await embedRes.json();
        if (embedData.data && Array.isArray(embedData.data)) {
          embeddingModels = embedData.data.map((m: any) => ({
            key: m.id,
            name: m.name || m.id,
          }));
        }
      }

      return {
        chat: chatModels,
        embedding: embeddingModels,
      };
    } catch (err) {
      console.error('Error fetching OpenRouter models:', err);
      return { chat: [], embedding: [] };
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

  async loadChatModel(key: string): Promise<BaseLLM<any>> {
    const modelList = await this.getModelList();
    const exists = modelList.chat.find((m) => m.key === key);

    if (!exists) {
      throw new Error(
        'Error Loading OpenRouter Chat Model. Invalid Model Selected.',
      );
    }

    return new OpenRouterLLM({
      apiKey: this.config.apiKey,
      model: key,
      baseURL: OPENROUTER_BASE_URL,
    });
  }

  async loadEmbeddingModel(key: string): Promise<BaseEmbedding<any>> {
    const modelList = await this.getModelList();
    const exists = modelList.embedding.find((m) => m.key === key);

    if (!exists) {
      throw new Error(
        'Error Loading OpenRouter Embedding Model. Invalid Model Selected.',
      );
    }

    return new OpenRouterEmbedding({
      apiKey: this.config.apiKey,
      model: key,
      baseURL: OPENROUTER_BASE_URL,
    });
  }

  static parseAndValidate(raw: any): OpenRouterConfig {
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
      key: 'openrouter',
      name: 'OpenRouter',
    };
  }
}

export default OpenRouterProvider;
