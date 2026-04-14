import { UIConfigField } from '@/lib/config/types';
import { getConfiguredModelProviderById } from '@/lib/config/serverRegistry';
import { Model, ModelList, ProviderMetadata } from '../../types';
import BaseEmbedding from '../../base/embedding';
import BaseModelProvider from '../../base/provider';
import BaseLLM from '../../base/llm';
import ModelsLabLLM from './modelsLabLLM';

/**
 * ModelsLab provider for Perplexica
 *
 * ModelsLab provides OpenAI-compatible chat completion APIs with uncensored
 * LLMs, image generation, video generation, and audio generation.
 *
 * API docs: https://docs.modelslab.com
 * API key:  https://modelslab.com/dashboard/settings/api-keys
 */

const MODELSLAB_BASE_URL =
  'https://modelslab.com/api/uncensored-chat/v1';

interface ModelsLabConfig {
  apiKey: string;
}

/**
 * Default hardcoded models — ModelsLab doesn't expose a /v1/models listing
 * endpoint for their uncensored chat API, so we provide the canonical set here.
 * Users can always add extra models through the Perplexica settings UI.
 */
const DEFAULT_MODELSLAB_CHAT_MODELS: Model[] = [
  {
    key: 'meta-llama/llama-3.1-8b-instruct-uncensored',
    name: 'Llama 3.1 8B Uncensored',
  },
  {
    key: 'meta-llama/llama-3.1-70b-instruct-uncensored',
    name: 'Llama 3.1 70B Uncensored',
  },
  {
    key: 'meta-llama/llama-3.3-70b-instruct',
    name: 'Llama 3.3 70B Instruct',
  },
  {
    key: 'mistralai/mistral-7b-instruct-v0.3',
    name: 'Mistral 7B Instruct v0.3',
  },
  {
    key: 'deepseek-ai/deepseek-r1-distill-llama-70b',
    name: 'DeepSeek R1 Distill Llama 70B',
  },
];

const providerConfigFields: UIConfigField[] = [
  {
    type: 'password',
    name: 'API Key',
    key: 'apiKey',
    description: 'Your ModelsLab API key (get one at modelslab.com/dashboard)',
    required: true,
    placeholder: 'ModelsLab API Key',
    env: 'MODELSLAB_API_KEY',
    scope: 'server',
  },
];

class ModelsLabProvider extends BaseModelProvider<ModelsLabConfig> {
  constructor(id: string, name: string, config: ModelsLabConfig) {
    super(id, name, config);
  }

  async getDefaultModels(): Promise<ModelList> {
    return {
      embedding: [],
      chat: DEFAULT_MODELSLAB_CHAT_MODELS,
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
        `Error loading ModelsLab chat model. Invalid model selected: ${key}`,
      );
    }

    return new ModelsLabLLM({
      apiKey: this.config.apiKey,
      model: key,
      baseURL: MODELSLAB_BASE_URL,
    });
  }

  async loadEmbeddingModel(_key: string): Promise<BaseEmbedding<any>> {
    throw new Error('ModelsLab provider does not support embedding models.');
  }

  static parseAndValidate(raw: any): ModelsLabConfig {
    if (!raw || typeof raw !== 'object') {
      throw new Error('Invalid config provided. Expected an object.');
    }
    if (!raw.apiKey) {
      throw new Error(
        'Invalid config provided. API key must be provided. ' +
          'Get one at https://modelslab.com/dashboard/settings/api-keys',
      );
    }

    return {
      apiKey: String(raw.apiKey),
    };
  }

  static getProviderConfigFields(): UIConfigField[] {
    return providerConfigFields;
  }

  static getProviderMetadata(): ProviderMetadata {
    return {
      key: 'modelslab',
      name: 'ModelsLab',
    };
  }
}

export default ModelsLabProvider;
