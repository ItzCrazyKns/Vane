import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { Model, ModelList, ProviderMetadata } from '../types';
import BaseModelProvider from './baseProvider';
import { ChatGroq } from '@langchain/groq';
import { Embeddings } from '@langchain/core/embeddings';
import { UIConfigField } from '@/lib/config/types';
import { getConfiguredModelProviderById } from '@/lib/config/serverRegistry';

interface GroqConfig {
  apiKey: string;
}

const providerConfigFields: UIConfigField[] = [
  {
    type: 'password',
    name: 'API Key',
    key: 'apiKey',
    description: 'Your Groq API key',
    required: true,
    placeholder: 'Groq API Key',
    env: 'GROQ_API_KEY',
    scope: 'server',
  },
];

class GroqProvider extends BaseModelProvider<GroqConfig> {
  constructor(id: string, name: string, config: GroqConfig) {
    super(id, name, config);
  }

  async getDefaultModels(): Promise<ModelList> {
    try {
      const res = await fetch('https://api.groq.com/openai/v1/models', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.config.apiKey}`,
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
        embedding: [],
        chat: models,
      };
    } catch (err) {
      if (err instanceof TypeError) {
        throw new Error(
          'Error connecting to Groq API. Please ensure your API key is correct and the Groq service is available.',
        );
      }

      throw err;
    }
  }

  async getModelList(): Promise<ModelList> {
    const defaultModels = await this.getDefaultModels();
    const configProvider = getConfiguredModelProviderById(this.id)!;

    return {
      embedding: [],
      chat: [...defaultModels.chat, ...configProvider.chatModels],
    };
  }

  async loadChatModel(key: string): Promise<BaseChatModel> {
    const modelList = await this.getModelList();

    const exists = modelList.chat.find((m) => m.key === key);

    if (!exists) {
      throw new Error('Error Loading Groq Chat Model. Invalid Model Selected');
    }

    return new ChatGroq({
      apiKey: this.config.apiKey,
      temperature: 0.7,
      model: key,
    });
  }

  async loadEmbeddingModel(key: string): Promise<Embeddings> {
    throw new Error('Groq provider does not support embedding models.');
  }

  static parseAndValidate(raw: any): GroqConfig {
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
      key: 'groq',
      name: 'Groq',
    };
  }
}

export default GroqProvider;
