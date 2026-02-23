import { UIConfigField } from '@/lib/config/types';
import { Model, ModelList, ProviderMetadata } from '../../types';
import BaseEmbedding from '../../base/embedding';
import BaseModelProvider from '../../base/provider';
import BaseLLM from '../../base/llm';
import MinimaxLLM from './minimaxLLM';

interface MinimaxConfig {
  apiKey: string;
}

const providerConfigFields: UIConfigField[] = [
  {
    type: 'password',
    name: 'API Key',
    key: 'apiKey',
    description: 'Your Minimax API key',
    required: true,
    placeholder: 'Minimax API Key',
    env: 'MINIMAX_API_KEY',
    scope: 'server',
  },
];

class MinimaxProvider extends BaseModelProvider<MinimaxConfig> {
  constructor(id: string, name: string, config: MinimaxConfig) {
    super(id, name, config);
  }

  async getDefaultModels(): Promise<ModelList> {
    const defaultChatModels: Model[] = [
      { key: 'MiniMax-M2.5', name: 'MiniMax-M2.5' },
      { key: 'MiniMax-M2.5-highspeed', name: 'MiniMax-M2.5-highspeed' },
      { key: 'MiniMax-M2.1', name: 'MiniMax-M2.1' },
      { key: 'MiniMax-M2.1-highspeed', name: 'MiniMax-M2.1-highspeed' },
      { key: 'MiniMax-M2', name: 'MiniMax-M2' },
    ];

    return {
      embedding: [],
      chat: defaultChatModels,
    };
  }

  async getModelList(): Promise<ModelList> {
    return this.getDefaultModels();
  }

  async loadChatModel(key: string): Promise<BaseLLM<any>> {
    const modelList = await this.getModelList();

    const exists = modelList.chat.find((m) => m.key === key);

    if (!exists) {
      throw new Error(
        'Error Loading Minimax Chat Model. Invalid Model Selected',
      );
    }

    return new MinimaxLLM({
      apiKey: this.config.apiKey,
      model: key,
      baseURL: 'https://api.minimax.io/v1',
    });
  }

  async loadEmbeddingModel(
    key: string,
  ): Promise<BaseEmbedding<any>> {
    throw new Error('Minimax Provider does not support embedding models.');
  }

  static parseAndValidate(raw: any): MinimaxConfig {
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
      key: 'minimax',
      name: 'Minimax',
    };
  }
}

export default MinimaxProvider;
