import { UIConfigField } from '@/lib/config/types';
import { getConfiguredModelProviders } from '@/lib/config/serverRegistry';
import { Model, ModelList, ProviderMetadata } from '../../types';
import BaseEmbedding from '../../base/embedding';
import BaseModelProvider, { createProviderInstance } from '../../base/provider';
import BaseLLM from '../../base/llm';
import RouterLLM, { RouterTarget } from './routerLLM';

interface RouterConfig {
  routes: string;
}

type RouterRoute = {
  key: string;
  name: string;
  targets: RouterTarget[];
};

const ROUTER_PROVIDER_KEY = 'router';

const providerConfigFields: UIConfigField[] = [
  {
    type: 'textarea',
    name: 'Routes',
    key: 'routes',
    description:
      'A JSON array of fallback routes. Each route has a name, an optional key, and an ordered list of targets. A target is matched against a configured connection by id, provider type, or connection name, and falls back to the next target when a request fails. Example: [{"name":"GPT-4o with fallback","key":"gpt-4o-fallback","targets":[{"provider":"OpenAI","model":"gpt-4o"},{"provider":"Groq","model":"llama-3.3-70b-versatile"}]}]',
    required: true,
    placeholder:
      '[{"name":"My route","key":"my-route","targets":[{"provider":"OpenAI","model":"gpt-4o"}]}]',
    env: 'MODEL_ROUTER_ROUTES',
    scope: 'server',
  },
];

const slugify = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

const parseTargets = (raw: unknown, routeIndex: number): RouterTarget[] => {
  if (!Array.isArray(raw) || raw.length === 0) {
    throw new Error(
      `Route at index ${routeIndex} must have at least one target`,
    );
  }

  return raw.map((target, targetIndex) => {
    if (!target || typeof target !== 'object') {
      throw new Error(
        `Target at index ${targetIndex} of route ${routeIndex} must be an object`,
      );
    }

    const provider = String((target as any).provider ?? '').trim();
    const model = String((target as any).model ?? '').trim();

    if (!provider || !model) {
      throw new Error(
        `Target at index ${targetIndex} of route ${routeIndex} must include both "provider" and "model"`,
      );
    }

    return { provider, model };
  });
};

const parseRoutes = (raw: string): RouterRoute[] => {
  let parsed: unknown;

  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    throw new Error(
      `Routes must be valid JSON: ${
        err instanceof Error ? err.message : String(err)
      }`,
    );
  }

  if (!Array.isArray(parsed)) {
    throw new Error('Routes must be a JSON array');
  }

  if (parsed.length === 0) {
    throw new Error('Routes must contain at least one route');
  }

  const seenKeys = new Set<string>();

  return parsed.map((route, routeIndex) => {
    if (!route || typeof route !== 'object') {
      throw new Error(`Route at index ${routeIndex} must be an object`);
    }

    const name = String((route as any).name ?? '').trim();
    if (!name) {
      throw new Error(`Route at index ${routeIndex} must include a "name"`);
    }

    const key = String((route as any).key ?? slugify(name)).trim();
    if (!key) {
      throw new Error(
        `Route "${name}" must include a "key" or a name that can be used as one`,
      );
    }

    /*
     * `error` is the sentinel the model list uses to report a provider that
     * failed to load. A route with that key would be hidden by the settings UI
     * and could not be selected.
     */
    if (key === 'error') {
      throw new Error(
        `Route "${name}" cannot use the reserved key "error". Choose a different key.`,
      );
    }

    if (seenKeys.has(key)) {
      throw new Error(`Duplicate route key "${key}"`);
    }
    seenKeys.add(key);

    return {
      key,
      name,
      targets: parseTargets((route as any).targets, routeIndex),
    };
  });
};

class RouterProvider extends BaseModelProvider<RouterConfig> {
  constructor(id: string, name: string, config: RouterConfig) {
    super(id, name, config);
  }

  private getRoutes(): RouterRoute[] {
    return parseRoutes(this.config.routes);
  }

  async getDefaultModels(): Promise<ModelList> {
    const routes = this.getRoutes();

    return {
      embedding: [],
      chat: routes.map<Model>((route) => ({
        name: route.name,
        key: route.key,
      })),
    };
  }

  async getModelList(): Promise<ModelList> {
    return this.getDefaultModels();
  }

  private async loadTargetModel(target: RouterTarget): Promise<BaseLLM<any>> {
    const ref = target.provider.trim();
    const normalizedRef = ref.toLowerCase();

    const configuredProviders = getConfiguredModelProviders().filter(
      (p) => p.id !== this.id,
    );

    const provider =
      configuredProviders.find((p) => p.id === ref) ??
      configuredProviders.find((p) => p.type.toLowerCase() === normalizedRef) ??
      configuredProviders.find((p) => p.name.toLowerCase() === normalizedRef);

    if (!provider) {
      throw new Error(
        `No configured connection matches "${ref}". Use a connection name, provider type, or provider id.`,
      );
    }

    if (provider.type === ROUTER_PROVIDER_KEY) {
      throw new Error('Nested Model Router targets are not supported');
    }

    const { providers } = await import('../index');
    const Provider = providers[provider.type];

    if (!Provider) {
      throw new Error(`Unknown provider type "${provider.type}"`);
    }

    const instance = createProviderInstance(
      Provider,
      provider.id,
      provider.name,
      provider.config,
    );

    return instance.loadChatModel(target.model);
  }

  async loadChatModel(key: string): Promise<BaseLLM<any>> {
    const routes = this.getRoutes();
    const route = routes.find((r) => r.key === key);

    if (!route) {
      throw new Error(
        `Error Loading Model Router Chat Model. Invalid Model Selected: ${key}`,
      );
    }

    return new RouterLLM({
      routeKey: route.key,
      targets: route.targets,
      loader: (target) => this.loadTargetModel(target),
    });
  }

  async loadEmbeddingModel(key: string): Promise<BaseEmbedding<any>> {
    throw new Error('Model Router does not support embedding models.');
  }

  static parseAndValidate(raw: any): RouterConfig {
    if (!raw || typeof raw !== 'object') {
      throw new Error('Invalid config provided. Expected object');
    }

    if (typeof raw.routes !== 'string' || raw.routes.trim().length === 0) {
      throw new Error(
        'Invalid config provided. Routes must be provided as a JSON string',
      );
    }

    try {
      parseRoutes(raw.routes);
    } catch (err) {
      throw new Error(
        `Invalid Model Router config: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }

    return {
      routes: raw.routes,
    };
  }

  static getProviderConfigFields(): UIConfigField[] {
    return providerConfigFields;
  }

  static getProviderMetadata(): ProviderMetadata {
    return {
      key: ROUTER_PROVIDER_KEY,
      name: 'Model Router',
    };
  }
}

export default RouterProvider;
