import { ConfigModelProvider } from '../config/types';
import BaseModelProvider, {
  createProviderInstance,
} from './providers/baseProvider';
import { getConfiguredModelProviders } from '../config/serverRegistry';
import { providers } from './providers';
import { ModelList } from './types';

class ModelRegistry {
  activeProviders: (ConfigModelProvider & {
    provider: BaseModelProvider<any>;
  })[] = [];

  constructor() {
    this.initializeActiveProviders();
  }

  private initializeActiveProviders() {
    const configuredProviders = getConfiguredModelProviders();

    configuredProviders.forEach((p) => {
      try {
        const provider = providers[p.type];
        if (!provider) throw new Error('Invalid provider type');

        this.activeProviders.push({
          ...p,
          provider: createProviderInstance(provider, p.id, p.name, p.config),
        });
      } catch (err) {
        console.error(
          `Failed to initialize provider. Type: ${p.type}, ID: ${p.id}, Config: ${JSON.stringify(p.config)}, Error: ${err}`,
        );
      }
    });
  }

  async getActiveModels() {
    const models: ModelList[] = [];

    await Promise.all(
      this.activeProviders.map(async (p) => {
        const m = await p.provider.getModelList();

        models.push(m);
      }),
    );

    return models;
  }
}

export default ModelRegistry;
