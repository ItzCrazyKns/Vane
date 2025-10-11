import { Embeddings } from '@langchain/core/embeddings';
import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { Model, ModelList, ProviderMetadata } from '../types';
import { UIConfigField } from '@/lib/config/types';

abstract class BaseModelProvider<CONFIG> {
  constructor(protected config: CONFIG) {}
  abstract getDefaultModels(): Promise<ModelList>;
  abstract getModelList(): Promise<ModelList>;
  abstract loadChatModel(modelName: string): Promise<BaseChatModel>;
  abstract loadEmbeddingModel(modelName: string): Promise<Embeddings>;
  static getProviderConfigFields(): UIConfigField[] {
    throw new Error('Method not implemented.');
  }
  static getProviderMetadata(): ProviderMetadata {
    throw new Error('Method not Implemented.');
  }
}

export default BaseModelProvider;
