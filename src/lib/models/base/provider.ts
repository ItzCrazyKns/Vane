import { ModelList, ProviderMetadata } from '../types';
import { UIConfigField } from '@/lib/config/types';
import BaseLLM from './llm';
import BaseEmbedding from './embedding';
import { getCachedModelList } from '../modelListCache';

export type ModelListOptions = {
  /** Skip the short-lived cache and ask the provider again. */
  fresh?: boolean;
};

abstract class BaseModelProvider<CONFIG> {
  constructor(
    protected id: string,
    protected name: string,
    protected config: CONFIG,
  ) {}
  abstract getDefaultModels(): Promise<ModelList>;
  abstract getModelList(opts?: ModelListOptions): Promise<ModelList>;
  abstract loadChatModel(modelName: string): Promise<BaseLLM<any>>;
  abstract loadEmbeddingModel(modelName: string): Promise<BaseEmbedding<any>>;

  /** getDefaultModels() through the shared model-list cache. */
  protected cachedDefaultModels(opts?: ModelListOptions): Promise<ModelList> {
    return getCachedModelList(
      this.id,
      this.config,
      () => this.getDefaultModels(),
      opts,
    );
  }

  /**
   * Whether the provider offers this model. Checks the cached list first and,
   * on a miss, asks the provider again, so a model loaded a moment ago (for
   * example in LM Studio) is found without waiting for the cache to expire.
   */
  protected async hasModel(
    type: 'chat' | 'embedding',
    key: string,
  ): Promise<boolean> {
    const cached = await this.getModelList();
    if (cached[type].some((m) => m.key === key)) return true;

    const fresh = await this.getModelList({ fresh: true });
    return fresh[type].some((m) => m.key === key);
  }

  static getProviderConfigFields(): UIConfigField[] {
    throw new Error('Method not implemented.');
  }
  static getProviderMetadata(): ProviderMetadata {
    throw new Error('Method not Implemented.');
  }
  static parseAndValidate(raw: any): any {
    /* Static methods can't access class type parameters */
    throw new Error('Method not Implemented.');
  }
}

export type ProviderConstructor<CONFIG> = {
  new (id: string, name: string, config: CONFIG): BaseModelProvider<CONFIG>;
  parseAndValidate(raw: any): CONFIG;
  getProviderConfigFields: () => UIConfigField[];
  getProviderMetadata: () => ProviderMetadata;
};

export const createProviderInstance = <P extends ProviderConstructor<any>>(
  Provider: P,
  id: string,
  name: string,
  rawConfig: unknown,
): InstanceType<P> => {
  const cfg = Provider.parseAndValidate(rawConfig);
  return new Provider(id, name, cfg) as InstanceType<P>;
};

export default BaseModelProvider;
