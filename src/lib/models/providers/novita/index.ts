import { UIConfigField } from '@/lib/config/types';
import { getConfiguredModelProviderById } from '@/lib/config/serverRegistry';
import { Model, ModelList, ProviderMetadata } from '../../types';
import BaseEmbedding from '../../base/embedding';
import BaseModelProvider from '../../base/provider';
import BaseLLM from '../../base/llm';
import NovitaLLM from './novitaLLM';
import NovitaEmbedding from './novitaEmbedding';

interface NovitaConfig {
  apiKey: string;
}

const providerConfigFields: UIConfigField[] = [
  {
    type: 'password',
    name: 'API Key',
    key: 'apiKey',
    description: 'Your Novita AI API key',
    required: true,
    placeholder: 'Novita AI API Key',
    env: 'NOVITA_API_KEY',
    scope: 'server',
  },
];

class NovitaProvider extends BaseModelProvider<NovitaConfig> {
  constructor(id: string, name: string, config: NovitaConfig) {
    super(id, name, config);
  }

  async getDefaultModels(): Promise<ModelList> {
    const res = await fetch(`https://api.novita.ai/openai/models`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.config.apiKey}`,
      },
    });

    const data = await res.json();

    const defaultChatModels: Model[] = [];

    if (data.data && Array.isArray(data.data)) {
      data.data.forEach((m: any) => {
        defaultChatModels.push({
          key: m.id,
          name: m.id,
        });
      });
    }

    return {
      embedding: [],
      chat: defaultChatModels,
    };
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
        'Error Loading Novita Chat Model. Invalid Model Selected',
      );
    }

    return new NovitaLLM({
      apiKey: this.config.apiKey,
      model: key,
      baseURL: 'https://api.novita.ai/openai',
    });
  }

  async loadEmbeddingModel(key: string): Promise<BaseEmbedding<any>> {
    const modelList = await this.getModelList();
    const exists = modelList.embedding.find((m) => m.key === key);

    if (!exists) {
      throw new Error(
        'Error Loading Novita Embedding Model. Invalid Model Selected.',
      );
    }

    return new NovitaEmbedding({
      apiKey: this.config.apiKey,
      model: key,
      baseURL: 'https://api.novita.ai/openai',
    });
  }

  static parseAndValidate(raw: any): NovitaConfig {
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
      key: 'novita',
      name: 'Novita AI',
    };
  }
}

export default NovitaProvider;
