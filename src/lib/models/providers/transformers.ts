import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { Model, ModelList, ProviderMetadata } from '../types';
import BaseModelProvider from './baseProvider';
import { Embeddings } from '@langchain/core/embeddings';
import { UIConfigField } from '@/lib/config/types';
import { getConfiguredModelProviderById } from '@/lib/config/serverRegistry';
import { HuggingFaceTransformersEmbeddings } from '@/lib/huggingfaceTransformer';

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

    return {
      embedding: [
        ...defaultModels.embedding,
        ...configProvider.embeddingModels,
      ],
      chat: [],
    };
  }

  async loadChatModel(key: string): Promise<BaseChatModel> {
    throw new Error('Transformers Provider does not support chat models.');
  }

  async loadEmbeddingModel(key: string): Promise<Embeddings> {
    const modelList = await this.getModelList();
    const exists = modelList.embedding.find((m) => m.key === key);

    if (!exists) {
      throw new Error(
        'Error Loading OpenAI Embedding Model. Invalid Model Selected.',
      );
    }

    return new HuggingFaceTransformersEmbeddings({
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
