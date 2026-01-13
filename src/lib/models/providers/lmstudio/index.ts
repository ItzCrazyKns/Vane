import { UIConfigField } from '@/lib/config/types';
import {
  getConfiguredModelProviderById,
  mergeModelsWithExclusions,
} from '@/lib/config/serverRegistry';
import BaseModelProvider from '../../base/provider';
import { Model, ModelList, ProviderMetadata } from '../../types';
import LMStudioLLM from './lmstudioLLM';
import BaseLLM from '../../base/llm';
import BaseEmbedding from '../../base/embedding';
import LMStudioEmbedding from './lmstudioEmbedding';

interface LMStudioConfig {
  baseURL: string;
}

const providerConfigFields: UIConfigField[] = [
  {
    type: 'string',
    name: 'Base URL',
    key: 'baseURL',
    description: 'The base URL for LM Studio server',
    required: true,
    placeholder: 'http://localhost:1234',
    env: 'LM_STUDIO_BASE_URL',
    scope: 'server',
  },
];

class LMStudioProvider extends BaseModelProvider<LMStudioConfig> {
  constructor(id: string, name: string, config: LMStudioConfig) {
    super(id, name, config);
  }

  private normalizeBaseURL(url: string): string {
    const trimmed = url.trim().replace(/\/+$/, '');
    return trimmed.endsWith('/v1') ? trimmed : `${trimmed}/v1`;
  }

  async getDefaultModels(): Promise<ModelList> {
    try {
      const baseURL = this.normalizeBaseURL(this.config.baseURL);

      const res = await fetch(`${baseURL}/models`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const data = await res.json();

      const models: Model[] = data.data.map((m: any) => {
        return {
          name: m.id,
          key: m.id,
        };
      });

      return {
        embedding: models,
        chat: models,
      };
    } catch (err) {
      if (err instanceof TypeError) {
        throw new Error(
          'Error connecting to LM Studio. Please ensure the base URL is correct and the LM Studio server is running.',
        );
      }

      throw err;
    }
  }

  async getModelList(): Promise<ModelList> {
    const defaultModels = await this.getDefaultModels();
    const configProvider = getConfiguredModelProviderById(this.id)!;
    return mergeModelsWithExclusions(defaultModels, configProvider);
  }

  async loadChatModel(key: string): Promise<BaseLLM<any>> {
    const modelList = await this.getModelList();

    const exists = modelList.chat.find((m) => m.key === key);

    if (!exists) {
      throw new Error(
        'Error Loading LM Studio Chat Model. Invalid Model Selected',
      );
    }

    return new LMStudioLLM({
      apiKey: 'lm-studio',
      model: key,
      baseURL: this.normalizeBaseURL(this.config.baseURL),
    });
  }

  async loadEmbeddingModel(key: string): Promise<BaseEmbedding<any>> {
    const modelList = await this.getModelList();
    const exists = modelList.embedding.find((m) => m.key === key);

    if (!exists) {
      throw new Error(
        'Error Loading LM Studio Embedding Model. Invalid Model Selected.',
      );
    }

    return new LMStudioEmbedding({
      apiKey: 'lm-studio',
      model: key,
      baseURL: this.normalizeBaseURL(this.config.baseURL),
    });
  }

  static parseAndValidate(raw: any): LMStudioConfig {
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
      key: 'lmstudio',
      name: 'LM Studio',
    };
  }
}

export default LMStudioProvider;
