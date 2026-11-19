import { UIConfigField } from '@/lib/config/types';
import { getConfiguredModelProviderById } from '@/lib/config/serverRegistry';
import BaseModelProvider from '../../base/provider';
import { Model, ModelList, ProviderMetadata } from '../../types';
import RapidMLXLLM from './rapidmlxLLM';
import BaseLLM from '../../base/llm';
import BaseEmbedding from '../../base/embedding';
import RapidMLXEmbedding from './rapidmlxEmbedding';

interface RapidMLXConfig {
  baseURL: string;
}

const providerConfigFields: UIConfigField[] = [
  {
    type: 'string',
    name: 'Base URL',
    key: 'baseURL',
    description: 'The base URL for Rapid-MLX server',
    required: true,
    placeholder: 'http://127.0.0.1:8000/v1',
    default: 'http://127.0.0.1:8000/v1',
    env: 'RAPID_MLX_BASE_URL',
    scope: 'server',
  },
];

class RapidMLXProvider extends BaseModelProvider<RapidMLXConfig> {
  constructor(id: string, name: string, config: RapidMLXConfig) {
    super(id, name, config);
  }

  private normalizeBaseURL(url: string): string {
    const trimmed = url.trim().replace(/\/+$/, '');
    return trimmed.endsWith('/v1') ? trimmed : `${trimmed}/v1`;
  }

  async getDefaultModels(): Promise<ModelList> {
    const baseURL = this.normalizeBaseURL(this.config.baseURL);
    let res: Response;

    try {
      res = await fetch(`${baseURL}/models`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });
    } catch (err) {
      if (err instanceof TypeError) {
        throw new Error(
          'Error connecting to Rapid-MLX. Please ensure the base URL is correct and the Rapid-MLX server is running.',
        );
      }

      throw err;
    }

    if (!res.ok) {
      throw new Error(
        `Error fetching Rapid-MLX models: ${res.status} ${res.statusText}`,
      );
    }

    const data = await res.json();

    const models = data.data as { id: string; capabilities?: string[] }[];
    const toModel = (model: { id: string }): Model => ({
      name: model.id,
      key: model.id,
    });

    return {
      embedding: models
        .filter((m) => m.capabilities?.includes('embedding'))
        .map(toModel),
      chat: models
        .filter((m) => !m.capabilities || m.capabilities.includes('text'))
        .map(toModel),
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
        'Error Loading Rapid-MLX Chat Model. Invalid Model Selected',
      );
    }

    return new RapidMLXLLM({
      apiKey: 'rapid-mlx',
      model: key,
      baseURL: this.normalizeBaseURL(this.config.baseURL),
    });
  }

  async loadEmbeddingModel(key: string): Promise<BaseEmbedding<any>> {
    const modelList = await this.getModelList();
    const exists = modelList.embedding.find((m) => m.key === key);

    if (!exists) {
      throw new Error(
        'Error Loading Rapid-MLX Embedding Model. Invalid Model Selected.',
      );
    }

    return new RapidMLXEmbedding({
      apiKey: 'rapid-mlx',
      model: key,
      baseURL: this.normalizeBaseURL(this.config.baseURL),
    });
  }

  static parseAndValidate(raw: any): RapidMLXConfig {
    if (!raw || typeof raw !== 'object')
      throw new Error('Invalid config provided. Expected object');

    return {
      baseURL: String(raw.baseURL || 'http://127.0.0.1:8000/v1'),
    };
  }

  static getProviderConfigFields(): UIConfigField[] {
    return providerConfigFields;
  }

  static getProviderMetadata(): ProviderMetadata {
    return {
      key: 'rapidmlx',
      name: 'Rapid-MLX',
    };
  }
}

export default RapidMLXProvider;
