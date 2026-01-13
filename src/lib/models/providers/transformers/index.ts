import { UIConfigField } from '@/lib/config/types';
import {
  getConfiguredModelProviderById,
  mergeModelsWithExclusions,
} from '@/lib/config/serverRegistry';
import { Model, ModelList, ProviderMetadata } from '../../types';
import BaseModelProvider from '../../base/provider';
import BaseLLM from '../../base/llm';
import BaseEmbedding from '../../base/embedding';
import TransformerEmbedding from './transformerEmbedding';

interface TransformersConfig {}

const defaultEmbeddingModels: Model[] = [
  {
    name: 'all-MiniLM-L6-v2',
    key: 'Xenova/all-MiniLM-L6-v2',
  },
  {
    name: 'mxbai-embed-large-v1',
    key: 'mixedbread-ai/mxbai-embed-large-v1',
  },
  {
    name: 'nomic-embed-text-v1',
    key: 'Xenova/nomic-embed-text-v1',
  },
];

const providerConfigFields: UIConfigField[] = [];

class TransformersProvider extends BaseModelProvider<TransformersConfig> {
  constructor(id: string, name: string, config: TransformersConfig) {
    super(id, name, config);
  }

  async getDefaultModels(): Promise<ModelList> {
    return {
      embedding: [...defaultEmbeddingModels],
      chat: [],
    };
  }

  async getModelList(): Promise<ModelList> {
    const defaultModels = await this.getDefaultModels();
    const configProvider = getConfiguredModelProviderById(this.id)!;
    return mergeModelsWithExclusions(defaultModels, configProvider);
  }

  async loadChatModel(key: string): Promise<BaseLLM<any>> {
    throw new Error('Transformers Provider does not support chat models.');
  }

  async loadEmbeddingModel(key: string): Promise<BaseEmbedding<any>> {
    const modelList = await this.getModelList();
    const exists = modelList.embedding.find((m) => m.key === key);

    if (!exists) {
      throw new Error(
        'Error Loading OpenAI Embedding Model. Invalid Model Selected.',
      );
    }

    return new TransformerEmbedding({
      model: key,
    });
  }

  static parseAndValidate(raw: any): TransformersConfig {
    return {};
  }

  static getProviderConfigFields(): UIConfigField[] {
    return providerConfigFields;
  }

  static getProviderMetadata(): ProviderMetadata {
    return {
      key: 'transformers',
      name: 'Transformers',
    };
  }
}

export default TransformersProvider;
