import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { Model, ModelList, ProviderMetadata } from '../types';
import BaseModelProvider from './baseProvider';
import { ChatOpenAI, OpenAIEmbeddings } from '@langchain/openai';
import { Embeddings } from '@langchain/core/embeddings';
import { UIConfigField } from '@/lib/config/types';

interface OpenAIConfig {
  name: string;
  apiKey: string;
  baseURL: string;
}

const defaultChatModels: Model[] = [
  {
    name: 'GPT-3.5 Turbo',
    key: 'gpt-3.5-turbo',
  },
  {
    name: 'GPT-4',
    key: 'gpt-4',
  },
  {
    name: 'GPT-4 turbo',
    key: 'gpt-4-turbo',
  },
  {
    name: 'GPT-4 omni',
    key: 'gpt-4o',
  },
  {
    name: 'GPT-4o (2024-05-13)',
    key: 'gpt-4o-2024-05-13',
  },
  {
    name: 'GPT-4 omni mini',
    key: 'gpt-4o-mini',
  },
  {
    name: 'GPT 4.1 nano',
    key: 'gpt-4.1-nano',
  },
  {
    name: 'GPT 4.1 mini',
    key: 'gpt-4.1-mini',
  },
  {
    name: 'GPT 4.1',
    key: 'gpt-4.1',
  },
  {
    name: 'GPT 5 nano',
    key: 'gpt-5-nano',
  },
  {
    name: 'GPT 5',
    key: 'gpt-5',
  },
  {
    name: 'GPT 5 Mini',
    key: 'gpt-5-mini',
  },
  {
    name: 'o1',
    key: 'o1',
  },
  {
    name: 'o3',
    key: 'o3',
  },
  {
    name: 'o3 Mini',
    key: 'o3-mini',
  },
  {
    name: 'o4 Mini',
    key: 'o4-mini',
  },
];

const defaultEmbeddingModels: Model[] = [
  {
    name: 'Text Embedding 3 Small',
    key: 'text-embedding-3-small',
  },
  {
    name: 'Text Embedding 3 Large',
    key: 'text-embedding-3-large',
  },
];

const providerConfigFields: UIConfigField[] = [
  /* {
    type: 'string',
    name: 'Name (Optional)',
    key: 'name',
    description: 'An optional name for this provider configuration',
    required: false,
    placeholder: 'Provider Name',
    scope: 'server',
  }, */ /* FOR NAME DIRECTLY CREATE INPUT IN FRONTEND */
  {
    type: 'password',
    name: 'API Key',
    key: 'apiKey',
    description: 'Your OpenAI API key',
    required: true,
    placeholder: 'OpenAI API Key',
    env: 'OPENAI_API_KEY',
    scope: 'server',
  },
  {
    type: 'string',
    name: 'Base URL',
    key: 'baseURL',
    description: 'The base URL for the OpenAI API',
    required: true,
    placeholder: 'OpenAI Base URL',
    default: 'https://api.openai.com/v1',
    env: 'OPENAI_BASE_URL',
    scope: 'server',
  },
];

class OpenAIProvider extends BaseModelProvider<OpenAIConfig> {
  constructor(config: OpenAIConfig) {
    super(config);
  }

  async getDefaultModels(): Promise<ModelList> {
    if (this.config.baseURL === 'https://api.openai.com/v1') {
      return {
        embedding: defaultEmbeddingModels,
        chat: defaultChatModels,
      };
    }

    return {
      embedding: [],
      chat: [],
    };
  }

  async getModelList(): Promise<ModelList> {
    /* Todo: IMPLEMENT MODEL READING FROM CONFIG FILE */
    const defaultModels = await this.getDefaultModels();

    return {
      embedding: [...defaultModels.embedding],
      chat: [...defaultModels.chat],
    };
  }

  async loadChatModel(key: string): Promise<BaseChatModel> {
    const modelList = await this.getModelList();

    const exists = modelList.chat.filter((m) => m.key === key);

    if (!exists) {
      throw new Error(
        'Error Loading OpenAI Chat Model. Invalid Model Selected',
      );
    }

    return new ChatOpenAI({
      apiKey: this.config.apiKey,
      temperature: 0.7,
      model: key,
      configuration: {
        baseURL: this.config.baseURL,
      },
    });
  }

  async loadEmbeddingModel(key: string): Promise<Embeddings> {
    const modelList = await this.getModelList();

    const exists = modelList.chat.filter((m) => m.key === key);

    if (!exists) {
      throw new Error(
        'Error Loading OpenAI Embedding Model. Invalid Model Selected.',
      );
    }

    return new OpenAIEmbeddings({
      apiKey: this.config.apiKey,
      model: key,
      configuration: {
        baseURL: this.config.baseURL,
      },
    });
  }

  static getProviderConfigFields(): UIConfigField[] {
    return providerConfigFields;
  }

  static getProviderMetadata(): ProviderMetadata {
    return {
      key: 'openai',
      name: 'OpenAI',
    };
  }
}

export default OpenAIProvider;
