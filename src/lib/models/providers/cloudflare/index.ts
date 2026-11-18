import { UIConfigField } from '@/lib/config/types';
import { getConfiguredModelProviderById } from '@/lib/config/serverRegistry';
import { Model, ModelList, ProviderMetadata } from '../../types';
import BaseEmbedding from '../../base/embedding';
import BaseModelProvider from '../../base/provider';
import BaseLLM from '../../base/llm';
import CloudflareLLM from './cloudflareLLM';
import CloudflareEmbedding from './cloudflareEmbedding';

interface CloudflareConfig {
  apiKey: string;
  accountId: string;
}

const CLOUDFLARE_API_BASE = 'https://api.cloudflare.com/client/v4';
const CHAT_TASK = /^text generation$/i;
const EMBEDDING_TASK = /^text embeddings?$/i;
const NON_CHAT_MODEL = /llama-guard|-lora$/i;

const MODEL_CACHE_TTL_MS = 5 * 60 * 1000;
const MODEL_REQUEST_TIMEOUT_MS = 15 * 1000;

/*
 * The catalog is fetched on every chat request when it is only discovered
 * lazily, which costs three round-trips per message and makes a single flaky
 * request fail the whole chat. Keep it around for a few minutes instead.
 */
const modelCache = new Map<string, { fetchedAt: number; models: ModelList }>();


const providerConfigFields: UIConfigField[] = [
  {
    type: 'password',
    name: 'API Token',
    key: 'apiKey',
    description: 'Your Cloudflare API token with Workers AI Read access',
    required: true,
    placeholder: 'Cloudflare API Token',
    env: 'CLOUDFLARE_API_TOKEN',
    scope: 'server',
  },
  {
    type: 'string',
    name: 'Account ID',
    key: 'accountId',
    description: 'Your Cloudflare account ID',
    required: true,
    placeholder: 'Cloudflare Account ID',
    env: 'CLOUDFLARE_ACCOUNT_ID',
    scope: 'server',
  },
];

class CloudflareProvider extends BaseModelProvider<CloudflareConfig> {
  constructor(id: string, name: string, config: CloudflareConfig) {
    super(id, name, config);
  }

  private getBaseURL(): string {
    return `${CLOUDFLARE_API_BASE}/accounts/${encodeURIComponent(
      this.config.accountId,
    )}/ai/v1`;
  }

  async getDefaultModels(): Promise<ModelList> {
    const chat: Model[] = [];
    const embedding: Model[] = [];

    const cacheKey = `${this.config.accountId}:${this.config.apiKey}`;
    const cached = modelCache.get(cacheKey);

    if (cached && Date.now() - cached.fetchedAt < MODEL_CACHE_TTL_MS) {
      return cached.models;
    }

    try {
      let page = 1;
      let totalPages = 1;

      do {
        const res = await fetch(
          `${CLOUDFLARE_API_BASE}/accounts/${encodeURIComponent(
            this.config.accountId,
          )}/ai/models/search?per_page=100&page=${page}`,
          {
            method: 'GET',
            headers: {
              Authorization: `Bearer ${this.config.apiKey}`,
              'Content-Type': 'application/json',
            },
            signal: AbortSignal.timeout(MODEL_REQUEST_TIMEOUT_MS),
          },
        );

        if (!res.ok) {
          const body = await res.text();
          throw new Error(
            `Failed to fetch Cloudflare Workers AI models (${res.status}): ${body}`,
          );
        }

        const data = await res.json();

        if (!Array.isArray(data.result)) {
          throw new Error(
            'Cloudflare Workers AI returned an invalid model list',
          );
        }

        data.result.forEach((m: any) => {
          const key = typeof m?.name === 'string' ? m.name : '';
          if (!key || NON_CHAT_MODEL.test(key)) return;

          const task = typeof m?.task?.name === 'string' ? m.task.name : '';

          if (CHAT_TASK.test(task)) {
            chat.push({ key, name: key });
          } else if (EMBEDDING_TASK.test(task)) {
            embedding.push({ key, name: key });
          }
        });

        totalPages = Number(data.result_info?.total_pages) || 1;
        page++;
      } while (page <= totalPages);
    } catch (err) {
      if (err instanceof TypeError) {
        throw new Error(
          'Error connecting to Cloudflare Workers AI. Please ensure the API token and account ID are correct.',
        );
      }

      throw err;
    }

    const models = {
      embedding,
      chat,
    };

    modelCache.set(cacheKey, { fetchedAt: Date.now(), models });

    return models;
  }

  async getModelList(): Promise<ModelList> {
    const defaultModels = await this.getDefaultModels();
    const configProvider = getConfiguredModelProviderById(this.id)!;

    const configuredChat = configProvider.chatModels ?? [];
    const configuredEmbedding = configProvider.embeddingModels ?? [];

    /*
     * Models the user added explicitly come first so they are easy to find (and
     * become the default selection), and are not listed twice when discovery
     * returns them as well.
     */
    return {
      embedding: [
        ...configuredEmbedding,
        ...defaultModels.embedding.filter(
          (m) => !configuredEmbedding.some((c) => c.key === m.key),
        ),
      ],
      chat: [
        ...configuredChat,
        ...defaultModels.chat.filter(
          (m) => !configuredChat.some((c) => c.key === m.key),
        ),
      ],
    };
  }

  async loadChatModel(key: string): Promise<BaseLLM<any>> {
    const modelList = await this.getModelList();

    const exists = modelList.chat.find((m) => m.key === key);

    if (!exists) {
      throw new Error(
        'Error Loading Cloudflare Workers AI Chat Model. Invalid Model Selected',
      );
    }

    return new CloudflareLLM({
      apiKey: this.config.apiKey,
      model: key,
      baseURL: this.getBaseURL(),
    });
  }

  async loadEmbeddingModel(key: string): Promise<BaseEmbedding<any>> {
    const modelList = await this.getModelList();
    const exists = modelList.embedding.find((m) => m.key === key);

    if (!exists) {
      throw new Error(
        'Error Loading Cloudflare Workers AI Embedding Model. Invalid Model Selected.',
      );
    }

    return new CloudflareEmbedding({
      apiKey: this.config.apiKey,
      model: key,
      baseURL: this.getBaseURL(),
    });
  }

  static parseAndValidate(raw: any): CloudflareConfig {
    if (!raw || typeof raw !== 'object')
      throw new Error('Invalid config provided. Expected object');
    if (!raw.apiKey || !raw.accountId)
      throw new Error(
        'Invalid config provided. API token and account ID must be provided',
      );

    return {
      apiKey: String(raw.apiKey),
      accountId: String(raw.accountId),
    };
  }

  static getProviderConfigFields(): UIConfigField[] {
    return providerConfigFields;
  }

  static getProviderMetadata(): ProviderMetadata {
    return {
      key: 'cloudflare',
      name: 'Cloudflare Workers AI',
    };
  }
}

export default CloudflareProvider;
