import { UIConfigField } from '@/lib/config/types';
import { getConfiguredModelProviderById } from '@/lib/config/serverRegistry';
import { Model, ModelList, ProviderMetadata } from '../../types';
import BaseEmbedding from '../../base/embedding';
import BaseModelProvider from '../../base/provider';
import BaseLLM from '../../base/llm';
import OpenAILLM from '../openai/openaiLLM';

interface CrowLLMConfig {
  apiKey: string;
  baseURL: string;
}

const defaultChatModels: Model[] = [
  { name: 'GLM 5.3', key: 'glm-5.3' },
  { name: 'DeepSeek V4 Flash', key: 'deepseek-v4-flash' },
  { name: 'Kimi K3', key: 'kimi-k3' },
  { name: 'Claude Opus 4.7', key: 'claude-opus-4-7' },
  { name: 'Gemini 3.7 Flash', key: 'gemini-3.7-flash' },
  { name: 'Grok 4.7 (free)', key: 'grok-4.7:free' },
];

const providerConfigFields: UIConfigField[] = [
  {
    type: 'password',
    name: 'API Key',
    key: 'apiKey',
    description: 'Your CrowLLM API key',
    required: true,
    placeholder: 'CrowLLM API Key',
    env: 'CROWLLM_API_KEY',
    scope: 'server',
  },
  {
    type: 'string',
    name: 'Base URL',
    key: 'baseURL',
    description: 'The base URL for the CrowLLM gateway',
    required: true,
    placeholder: 'CrowLLM Base URL',
    default: 'https://crowllm.com/v1',
    env: 'CROWLLM_BASE_URL',
    scope: 'server',
  },
];

class CrowLLMProvider extends BaseModelProvider<CrowLLMConfig> {
  constructor(id: string, name: string, config: CrowLLMConfig) {
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
        'Error Loading CrowLLM Chat Model. Invalid Model Selected',
      );
    }

    return new OpenAILLM({
      apiKey: this.config.apiKey,
      model: key,
      baseURL: this.config.baseURL,
    });
  }

  async loadEmbeddingModel(key: string): Promise<BaseEmbedding<any>> {
    throw new Error('CrowLLM does not provide embedding models');
  }

  static parseAndValidate(raw: any): CrowLLMConfig {
    if (!raw || typeof raw !== 'object')
      throw new Error('Invalid config provided. Expected object');
    if (!raw.apiKey || !raw.baseURL)
      throw new Error(
        'Invalid config provided. API key and base URL must be provided',
      );

    return {
      apiKey: String(raw.apiKey),
      baseURL: String(raw.baseURL),
    };
  }

  static getProviderConfigFields(): UIConfigField[] {
    return providerConfigFields;
  }

  static getProviderMetadata(): ProviderMetadata {
    return {
      key: 'crowllm',
      name: 'CrowLLM',
    };
  }
}

export default CrowLLMProvider;
