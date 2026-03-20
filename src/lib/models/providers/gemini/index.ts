import { UIConfigField } from '@/lib/config/types';
import { getConfiguredModelProviderById } from '@/lib/config/serverRegistry';
import { Model, ModelList, ProviderMetadata } from '../../types';
import GeminiEmbedding from './geminiEmbedding';
import BaseEmbedding from '../../base/embedding';
import BaseModelProvider from '../../base/provider';
import BaseLLM from '../../base/llm';
import GeminiLLM from './geminiLLM';

interface GeminiConfig {
  apiKey: string;
}

const providerConfigFields: UIConfigField[] = [
  {
    type: 'password',
    name: 'API Key',
    key: 'apiKey',
    description: 'Your Gemini API key',
    required: true,
    placeholder: 'Gemini API Key',
    env: 'GEMINI_API_KEY',
    scope: 'server',
  },
];

class GeminiProvider extends BaseModelProvider<GeminiConfig> {
  constructor(id: string, name: string, config: GeminiConfig) {
    super(id, name, config);
  }

  async getDefaultModels(): Promise<ModelList> {
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models?key=${this.config.apiKey}`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        },
      );

      if (!res.ok) {
        console.error(`Gemini models API returned ${res.status}`);
        return { embedding: [], chat: [] };
      }

      const data = await res.json();

      if (!data.models || !Array.isArray(data.models)) {
        return { embedding: [], chat: [] };
      }

      let defaultEmbeddingModels: Model[] = [];
      let defaultChatModels: Model[] = [];

      data.models.forEach((m: any) => {
        if (
          m.supportedGenerationMethods?.some(
            (genMethod: string) =>
              genMethod === 'embedText' || genMethod === 'embedContent',
          )
        ) {
          defaultEmbeddingModels.push({
            key: m.name,
            name: m.displayName,
          });
        } else if (
          m.supportedGenerationMethods?.includes('generateContent')
        ) {
          defaultChatModels.push({
            key: m.name,
            name: m.displayName,
          });
        }
      });

      return {
        embedding: defaultEmbeddingModels,
        chat: defaultChatModels,
      };
    } catch (err) {
      console.error('Error fetching Gemini models:', err);
      return { embedding: [], chat: [] };
    }
  }

  async getModelList(): Promise<ModelList> {
    const configProvider = getConfiguredModelProviderById(this.id)!;
    const hasUserChat = configProvider.chatModels.length > 0;
    const hasUserEmbed = configProvider.embeddingModels.length > 0;

    if (hasUserChat || hasUserEmbed) {
      const defaults = await this.getDefaultModels();
      return {
        chat: hasUserChat ? configProvider.chatModels : defaults.chat,
        embedding: hasUserEmbed ? configProvider.embeddingModels : defaults.embedding,
      };
    }

    return this.getDefaultModels();
  }

  async loadChatModel(key: string): Promise<BaseLLM<any>> {
    const modelList = await this.getModelList();

    const exists = modelList.chat.find((m) => m.key === key);

    if (!exists) {
      throw new Error(
        'Error Loading Gemini Chat Model. Invalid Model Selected',
      );
    }

    return new GeminiLLM({
      apiKey: this.config.apiKey,
      model: key,
      baseURL: 'https://generativelanguage.googleapis.com/v1beta/openai',
    });
  }

  async loadEmbeddingModel(key: string): Promise<BaseEmbedding<any>> {
    const modelList = await this.getModelList();
    const exists = modelList.embedding.find((m) => m.key === key);

    if (!exists) {
      throw new Error(
        'Error Loading Gemini Embedding Model. Invalid Model Selected.',
      );
    }

    return new GeminiEmbedding({
      apiKey: this.config.apiKey,
      model: key,
      baseURL: 'https://generativelanguage.googleapis.com/v1beta/openai',
    });
  }

  static parseAndValidate(raw: any): GeminiConfig {
    if (!raw || typeof raw !== 'object')
      throw new Error('Invalid config provided. Expected object');
    if (!raw.apiKey)
      throw new Error('Invalid config provided. API key must be provided');

    return {
      apiKey: String(raw.apiKey),
    };
  }

  static getProviderConfigFields(): UIConfigField[] {
    return providerConfigFields;
  }

  static getProviderMetadata(): ProviderMetadata {
    return {
      key: 'gemini',
      name: 'Gemini',
    };
  }
}

export default GeminiProvider;
