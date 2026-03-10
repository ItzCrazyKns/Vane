import { UIConfigField } from '@/lib/config/types';
import { Model, ModelList, ProviderMetadata } from '../../types';
import BaseEmbedding from '../../base/embedding';
import BaseModelProvider from '../../base/provider';
import BaseLLM from '../../base/llm';
import MiniMaxLLM from './minimaxLLM';

interface MiniMaxConfig {
  apiKey: string;
  baseURL?: string;
}

const providerConfigFields: UIConfigField[] = [
  {
    type: 'password',
    name: 'API Key',
    key: 'apiKey',
    description: 'Your MiniMax API key',
    required: true,
    placeholder: 'MiniMax API Key',
    env: 'MINIMAX_API_KEY',
    scope: 'server',
  },
  {
    type: 'string',
    name: 'Base URL',
    key: 'baseURL',
    description: 'MiniMax API base URL',
    required: false,
    placeholder: 'https://api.minimax.io/v1',
    default: 'https://api.minimax.io/v1',
    env: 'MINIMAX_BASE_URL',
    scope: 'server',
  },
];

const DEFAULT_MODELS: ModelList = {
  chat: [
    { key: 'MiniMax-M2.5', name: 'MiniMax M2.5' },
    { key: 'MiniMax-M2.5-highspeed', name: 'MiniMax M2.5 High Speed' },
  ],
  embedding: [],
};

class MiniMaxProvider extends BaseModelProvider<MiniMaxConfig> {
  constructor(id: string, name: string, config: MiniMaxConfig) {
    super(id, name, config);
  }

  async getDefaultModels(): Promise<ModelList> {
    return DEFAULT_MODELS;
  }

  async getModelList(): Promise<ModelList> {
    return DEFAULT_MODELS;
  }

  async loadChatModel(key: string): Promise<BaseLLM<any>> {
    const modelList = await this.getModelList();
    const exists = modelList.chat.find((m) => m.key === key);

    if (!exists) {
      throw new Error(
        'Error Loading MiniMax Chat Model. Invalid Model Selected',
      );
    }

    return new MiniMaxLLM({
      apiKey: this.config.apiKey,
      model: key,
      baseURL: this.config.baseURL || 'https://api.minimax.io/v1',
    });
  }

  async loadEmbeddingModel(key: string): Promise<BaseEmbedding<any>> {
    throw new Error('MiniMax provider does not support embedding models.');
  }

  static parseAndValidate(raw: any): MiniMaxConfig {
    if (!raw || typeof raw !== 'object')
      throw new Error('Invalid config provided. Expected object');
    if (!raw.apiKey)
      throw new Error('Invalid config provided. API key must be provided');

    return {
      apiKey: String(raw.apiKey),
      baseURL: raw.baseURL ? String(raw.baseURL) : undefined,
    };
  }

  static getProviderConfigFields(): UIConfigField[] {
    return providerConfigFields;
  }

  static getProviderMetadata(): ProviderMetadata {
    return {
      key: 'minimax',
      name: 'MiniMax',
    };
  }
}

export default MiniMaxProvider;
