import { UIConfigField } from '@/lib/config/types';
import { ModelList, ProviderMetadata } from '../../types';
import BaseModelProvider from '../../base/provider';
import BaseLLM from '../../base/llm';
import BaseEmbedding from '../../base/embedding';
import OpenAILLM from '../openai/openaiLLM';
import OpenAIEmbedding from '../openai/openaiEmbedding';
import {
  BIFROST_PROVIDER_ID,
  BIFROST_PROVIDER_NAME,
  bifrostChatHeaders,
  fetchBifrostModels,
} from '@/lib/bifrost';
import { normalizeBifrostURL } from '@/lib/config/serverRegistry';

export interface BifrostProviderConfig {
  url: string;
  virtualKey: string;
}

/**
 * Bifrost speaks the OpenAI API, so chat and embeddings reuse the OpenAI
 * classes pointed at <url>/v1. Models come from the gateway's /v1/models and
 * use its "provider/model" names (e.g. "anthropic/claude-sonnet-4-5").
 *
 * This provider is not stored in config.modelProviders: ModelRegistry adds it
 * while the Bifrost switch in Settings is on.
 */
class BifrostProvider extends BaseModelProvider<BifrostProviderConfig> {
  constructor(id: string, name: string, config: BifrostProviderConfig) {
    super(id, name, config);
  }

  async getDefaultModels(): Promise<ModelList> {
    return fetchBifrostModels(this.config);
  }

  async getModelList(): Promise<ModelList> {
    return this.getDefaultModels();
  }

  private clientOptions() {
    return {
      /* The OpenAI SDK needs a key; Bifrost reads the virtual key from x-bf-vk. */
      apiKey: this.config.virtualKey || 'bifrost',
      baseURL: `${this.config.url}/v1`,
      defaultHeaders: bifrostChatHeaders(this.config),
    };
  }

  /* No lookup in the model list here: it would cost a round trip per message,
     and Bifrost already rejects unknown models with a clear error. */
  async loadChatModel(key: string): Promise<BaseLLM<any>> {
    return new OpenAILLM({ ...this.clientOptions(), model: key });
  }

  async loadEmbeddingModel(key: string): Promise<BaseEmbedding<any>> {
    return new OpenAIEmbedding({ ...this.clientOptions(), model: key });
  }

  static parseAndValidate(raw: any): BifrostProviderConfig {
    const url = normalizeBifrostURL(raw?.url);
    if (!url)
      throw new Error('Invalid config provided. Bifrost URL is required');

    return { url, virtualKey: String(raw?.virtualKey ?? '').trim() };
  }

  /* Configured under Settings > Bifrost, not in the Add connection dialog. */
  static getProviderConfigFields(): UIConfigField[] {
    return [];
  }

  static getProviderMetadata(): ProviderMetadata {
    return { key: BIFROST_PROVIDER_ID, name: BIFROST_PROVIDER_NAME };
  }
}

export default BifrostProvider;
