import { UIConfigField } from '@/lib/config/types';
import { getConfiguredModelProviderById } from '@/lib/config/serverRegistry';
import { Model, ModelList, ProviderMetadata } from '../../types';
import BaseEmbedding from '../../base/embedding';
import BaseModelProvider from '../../base/provider';
import BaseLLM from '../../base/llm';
import MiniMaxAnthropicLLM from './minimaxAnthropicLLM';
import MiniMaxLLM from './minimaxLLM';

interface MiniMaxConfig {
  apiKey: string;
  baseURL: string;
}

const DEFAULT_BASE_URL = 'https://api.minimax.io/v1';

const endpointOptions = [
  {
    name: 'Global (OpenAI)',
    value: DEFAULT_BASE_URL,
  },
  {
    name: 'Global (Anthropic)',
    value: 'https://api.minimax.io/anthropic',
  },
  {
    name: 'China (OpenAI)',
    value: 'https://api.minimaxi.com/v1',
  },
  {
    name: 'China (Anthropic)',
    value: 'https://api.minimaxi.com/anthropic',
  },
];

const supportedBaseURLs = new Set(
  endpointOptions.map((endpoint) => endpoint.value),
);

const defaultChatModels: Model[] = [
  {
    name: 'MiniMax-M3.1-Flash (1M context)',
    key: 'MiniMax-M3.1-Flash',
  },
  {
    name: 'MiniMax-M3 (1M context)',
    key: 'MiniMax-M3',
  },
];

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
    type: 'select',
    name: 'API Endpoint',
    key: 'baseURL',
    description: 'Choose the MiniMax region and API protocol',
    required: true,
    default: DEFAULT_BASE_URL,
    options: endpointOptions,
    env: 'MINIMAX_BASE_URL',
    scope: 'server',
  },
];

class MiniMaxProvider extends BaseModelProvider<MiniMaxConfig> {
  constructor(id: string, name: string, config: MiniMaxConfig) {
    super(id, name, config);
  }

  async getDefaultModels(): Promise<ModelList> {
    return {
      embedding: [],
      chat: defaultChatModels,
    };
  }

  async getModelList(): Promise<ModelList> {
    const defaultModels = await this.getDefaultModels();
    const configProvider = getConfiguredModelProviderById(this.id)!;

    return {
      embedding: [],
      chat: [...defaultModels.chat, ...configProvider.chatModels],
    };
  }

  async loadChatModel(key: string): Promise<BaseLLM<any>> {
    const modelList = await this.getModelList();
    const exists = modelList.chat.find((model) => model.key === key);

    if (!exists) {
      throw new Error(
        'Error Loading MiniMax Chat Model. Invalid Model Selected',
      );
    }

    const config = {
      apiKey: this.config.apiKey,
      model: key,
      baseURL: this.config.baseURL,
    };

    if (this.config.baseURL.endsWith('/anthropic')) {
      return new MiniMaxAnthropicLLM(config);
    }

    return new MiniMaxLLM(config);
  }

  async loadEmbeddingModel(key: string): Promise<BaseEmbedding<any>> {
    throw new Error('MiniMax provider does not support embedding models.');
  }

  static parseAndValidate(raw: any): MiniMaxConfig {
    if (!raw || typeof raw !== 'object')
      throw new Error('Invalid config provided. Expected object');
    if (!raw.apiKey)
      throw new Error('Invalid config provided. API key must be provided');

    const baseURL = raw.baseURL ? String(raw.baseURL) : DEFAULT_BASE_URL;

    if (!supportedBaseURLs.has(baseURL)) {
      throw new Error('Invalid config provided. Unsupported API endpoint');
    }

    return {
      apiKey: String(raw.apiKey),
      baseURL,
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
