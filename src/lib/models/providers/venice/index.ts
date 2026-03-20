import { UIConfigField } from '@/lib/config/types';
import { getConfiguredModelProviderById } from '@/lib/config/serverRegistry';
import { Model, ModelList, ProviderMetadata } from '../../types';
import BaseEmbedding from '../../base/embedding';
import BaseModelProvider from '../../base/provider';
import BaseLLM from '../../base/llm';
import VeniceLLM from './veniceLLM';

interface VeniceConfig {
  apiKey: string;
}

const providerConfigFields: UIConfigField[] = [
  {
    type: 'password',
    name: 'API Key',
    key: 'apiKey',
    description: 'Your Venice.ai API key',
    required: true,
    placeholder: 'Venice API Key',
    env: 'VENICE_API_KEY',
    scope: 'server',
  },
];

class VeniceProvider extends BaseModelProvider<VeniceConfig> {
  constructor(id: string, name: string, config: VeniceConfig) {
    super(id, name, config);
  }

  async getDefaultModels(): Promise<ModelList> {
    try {
      const res = await fetch('https://api.venice.ai/api/v1/models', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.config.apiKey}`,
        },
      });

      if (!res.ok) {
        console.error(`Venice API returned status ${res.status}`);
        return { embedding: [], chat: [] };
      }

      const data = await res.json();
      const defaultChatModels: Model[] = [];

      if (data?.data && Array.isArray(data.data)) {
        data.data.forEach((m: any) => {
          if (m.type === 'text' || !m.type) {
            defaultChatModels.push({
              key: m.id,
              name: m.id,
            });
          }
        });
      }

      return {
        embedding: [],
        chat: defaultChatModels,
      };
    } catch (error) {
      console.error('Failed to fetch Venice models:', error);
      return { embedding: [], chat: [] };
    }
  }

  async getModelList(): Promise<ModelList> {
    const configProvider = getConfiguredModelProviderById(this.id);
    const hasUserChat = configProvider && configProvider.chatModels.length > 0;
    const hasUserEmbed = configProvider && configProvider.embeddingModels.length > 0;

    if (hasUserChat || hasUserEmbed) {
      return {
        chat: hasUserChat ? configProvider.chatModels : (await this.getDefaultModels()).chat,
        embedding: hasUserEmbed ? configProvider.embeddingModels : (await this.getDefaultModels()).embedding,
      };
    }

    return this.getDefaultModels();
  }

  async loadChatModel(key: string): Promise<BaseLLM<any>> {
    const modelList = await this.getModelList();

    const exists = modelList.chat.find((m) => m.key === key);

    if (!exists) {
      throw new Error(
        'Error Loading Venice Chat Model. Invalid Model Selected',
      );
    }

    return new VeniceLLM({
      apiKey: this.config.apiKey,
      model: key,
      baseURL: 'https://api.venice.ai/api/v1',
    });
  }

  async loadEmbeddingModel(key: string): Promise<BaseEmbedding<any>> {
    throw new Error('Venice Provider does not support embedding models.');
  }

  static parseAndValidate(raw: any): VeniceConfig {
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
      key: 'venice',
      name: 'Venice',
    };
  }
}

export default VeniceProvider;
