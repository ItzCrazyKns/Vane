import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { Model, ModelList, ProviderMetadata } from '../types';
import BaseModelProvider from './baseProvider';
import {
  ChatGoogleGenerativeAI,
  GoogleGenerativeAIEmbeddings,
} from '@langchain/google-genai';
import { Embeddings } from '@langchain/core/embeddings';
import { UIConfigField } from '@/lib/config/types';
import { getConfiguredModelProviderById } from '@/lib/config/serverRegistry';

interface GeminiConfig {
  apiKey: string;
}

const providerConfigFields: UIConfigField[] = [
  {
    type: 'password',
    name: 'API Key',
    key: 'apiKey',
    description: 'Your Google Gemini API key',
    required: true,
    placeholder: 'Google Gemini API Key',
    env: 'GEMINI_API_KEY',
    scope: 'server',
  },
];

class GeminiProvider extends BaseModelProvider<GeminiConfig> {
  constructor(id: string, name: string, config: GeminiConfig) {
    super(id, name, config);
  }

  async getDefaultModels(): Promise<ModelList> {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${this.config.apiKey}`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      },
    );

    const data = await res.json();

    let defaultEmbeddingModels: Model[] = [];
    let defaultChatModels: Model[] = [];

    data.models.forEach((m: any) => {
      if (
        m.supportedGenerationMethods.some(
          (genMethod: string) =>
            genMethod === 'embedText' || genMethod === 'embedContent',
        )
      ) {
        defaultEmbeddingModels.push({
          key: m.name,
          name: m.displayName,
        });
      } else if (m.supportedGenerationMethods.includes('generateContent')) {
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

  async loadChatModel(key: string): Promise<BaseChatModel> {
    const modelList = await this.getModelList();

    const exists = modelList.chat.find((m) => m.key === key);

    if (!exists) {
      throw new Error(
        'Error Loading Gemini Chat Model. Invalid Model Selected',
      );
    }

    return new ChatGoogleGenerativeAI({
      apiKey: this.config.apiKey,
      temperature: 0.7,
      model: key,
    });
  }

  async loadEmbeddingModel(key: string): Promise<Embeddings> {
    const modelList = await this.getModelList();
    const exists = modelList.embedding.find((m) => m.key === key);

    if (!exists) {
      throw new Error(
        'Error Loading Gemini Embedding Model. Invalid Model Selected.',
      );
    }

    return new GoogleGenerativeAIEmbeddings({
      apiKey: this.config.apiKey,
      model: key,
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
      name: 'Google Gemini',
    };
  }
}

export default GeminiProvider;
