import path from 'node:path';
import fs from 'fs';
import { Config, ConfigModelProvider, UIConfigSections } from './types';
import { hashObj } from '../serverUtils';
import { getModelProvidersUIConfigSection } from '../models/providers';

class ConfigManager {
  configPath: string = path.join(
    process.env.DATA_DIR || process.cwd(),
    '/data/config.json',
  );
  configVersion = 1;
  currentConfig: Config = {
    version: this.configVersion,
    setupComplete: false,
    preferences: {},
    personalization: {},
    modelProviders: [],
    search: {
      searxngURL: '',
    },
  };
  uiConfigSections: UIConfigSections = {
    preferences: [
      {
        name: 'Theme',
        key: 'theme',
        type: 'select',
        options: [
          {
            name: 'Light',
            value: 'light',
          },
          {
            name: 'Dark',
            value: 'dark',
          },
        ],
        required: false,
        description: 'Choose between light and dark layouts for the app.',
        default: 'dark',
        scope: 'client',
      },
      {
        name: 'Measurement Unit',
        key: 'measureUnit',
        type: 'select',
        options: [
          {
            name: 'Imperial',
            value: 'Imperial',
          },
          {
            name: 'Metric',
            value: 'Metric',
          },
        ],
        required: false,
        description: 'Choose between Metric  and Imperial measurement unit.',
        default: 'Metric',
        scope: 'client',
      },
      {
        name: 'Auto video & image search',
        key: 'autoMediaSearch',
        type: 'switch',
        required: false,
        description: 'Automatically search for relevant images and videos.',
        default: true,
        scope: 'client',
      },
      {
        name: 'Show weather widget',
        key: 'showWeatherWidget',
        type: 'switch',
        required: false,
        description: 'Display the weather card on the home screen.',
        default: true,
        scope: 'client',
      },
      {
        name: 'Show news widget',
        key: 'showNewsWidget',
        type: 'switch',
        required: false,
        description: 'Display the recent news card on the home screen.',
        default: true,
        scope: 'client',
      },
    ],
    personalization: [
      {
        name: 'System Instructions',
        key: 'systemInstructions',
        type: 'textarea',
        required: false,
        description: 'Add custom behavior or tone for the model.',
        placeholder:
          'e.g., "Respond in a friendly and concise tone" or "Use British English and format answers as bullet points."',
        scope: 'client',
      },
    ],
    modelProviders: [],
    search: [
      {
        name: 'SearXNG URL',
        key: 'searxngURL',
        type: 'string',
        required: false,
        description: 'The URL of your SearXNG instance',
        placeholder: 'http://localhost:4000',
        default: '',
        scope: 'server',
        env: 'SEARXNG_API_URL',
      },
    ],
  };

  constructor() {
    this.initialize();
  }

  private initialize() {
    this.initializeConfig();
    this.initializeFromEnv();
  }

  private saveConfig() {
    try {
      const dir = path.dirname(this.configPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(
        this.configPath,
        JSON.stringify(this.currentConfig, null, 2),
      );
    } catch (err) {
      console.error(
        `CRITICAL: Failed to save config to ${this.configPath}:`,
        err,
      );
    }
  }

  private initializeConfig() {
    const exists = fs.existsSync(this.configPath);
    if (!exists) {
      console.log('Config file not found, creating new one.');
      this.saveConfig();
    } else {
      try {
        const fileContent = fs.readFileSync(this.configPath, 'utf-8');
        if (!fileContent.trim()) {
          console.warn('Config file is empty, resetting to default.');
          this.saveConfig();
          return;
        }
        this.currentConfig = JSON.parse(fileContent);
        this.currentConfig = this.migrateConfig(this.currentConfig);
      } catch (err) {
        console.error(
          `Error parsing config file at ${this.configPath}. Keeping default in-memory config. Error:`,
          err,
        );
      }
    }
  }

  private migrateConfig(config: Config): Config {
    // Auto-select default models if missing
    if (!config.defaultChatModel && config.modelProviders && config.modelProviders.length > 0) {
      for (const p of config.modelProviders) {
        if (p.chatModels && p.chatModels.length > 0) {
          config.defaultChatModel = { providerId: p.id, key: p.chatModels[0].key };
          console.log(`Auto-selected default chat model: ${p.name} - ${p.chatModels[0].name}`);
          break;
        }
      }
    }

    if (!config.defaultEmbeddingModel && config.modelProviders && config.modelProviders.length > 0) {
      for (const p of config.modelProviders) {
        if (p.embeddingModels && p.embeddingModels.length > 0) {
          config.defaultEmbeddingModel = {
            providerId: p.id,
            key: p.embeddingModels[0].key,
          };
          console.log(`Auto-selected default embedding model: ${p.name} - ${p.embeddingModels[0].name}`);
          break;
        }
      }
    }

    return config;
  }

  private initializeFromEnv() {
    /* providers section*/
    const providerConfigSections = getModelProvidersUIConfigSection();

    this.uiConfigSections.modelProviders = providerConfigSections;

    const newProviders: ConfigModelProvider[] = [];

    providerConfigSections.forEach((provider) => {
      const newProvider: ConfigModelProvider & { required?: string[] } = {
        id: crypto.randomUUID(),
        name: `${provider.name}`,
        type: provider.key,
        chatModels: [],
        embeddingModels: [],
        config: {},
        required: [],
        hash: '',
      };

      provider.fields.forEach((field) => {
        newProvider.config[field.key] =
          process.env[field.env!] ||
          field.default ||
          ''; /* Env var must exist for providers */

        if (field.required) newProvider.required?.push(field.key);
      });

      let configured = true;

      newProvider.required?.forEach((r) => {
        if (!newProvider.config[r]) {
          configured = false;
        }
      });

      if (configured) {
        const hash = hashObj(newProvider.config);
        newProvider.hash = hash;
        delete newProvider.required;

        const exists = this.currentConfig.modelProviders.find(
          (p) => p.hash === hash,
        );

        if (!exists) {
          newProviders.push(newProvider);
        }
      }
    });

    this.currentConfig.modelProviders.push(...newProviders);

    const applyEnv = (
      sectionKey: 'search' | 'preferences' | 'personalization',
      sectionFields: typeof this.uiConfigSections.search,
    ) => {
      // Ensure the section exists in currentConfig
      if (!this.currentConfig[sectionKey]) {
        this.currentConfig[sectionKey] = {};
      }

      sectionFields.forEach((f) => {
        const keySnakeCase = f.key
          .replace(/([a-z])([A-Z])/g, '$1_$2')
          .toUpperCase();
        const structuredKey = `${sectionKey.toUpperCase()}_${keySnakeCase}`;
        const val =
          process.env[structuredKey] || (f.env ? process.env[f.env] : undefined);

        if (val) {
          this.currentConfig[sectionKey][f.key] = val;
        } else if (
          this.currentConfig[sectionKey][f.key] === undefined ||
          this.currentConfig[sectionKey][f.key] === ''
        ) {
          this.currentConfig[sectionKey][f.key] = f.default ?? '';
        }
      });
    };

    applyEnv('search', this.uiConfigSections.search);
    applyEnv('preferences', this.uiConfigSections.preferences);
    applyEnv('personalization', this.uiConfigSections.personalization);

    // Specific Default Models from Env
    if (process.env.CHAT_MODEL && process.env.CHAT_PROVIDER_TYPE) {
      const provider = this.currentConfig.modelProviders.find(
        (p) =>
          p.type === process.env.CHAT_PROVIDER_TYPE &&
          (!process.env.CHAT_PROVIDER_URL ||
            p.config.baseURL === process.env.CHAT_PROVIDER_URL),
      );

      if (provider) {
        this.currentConfig.defaultChatModel = {
          providerId: provider.id,
          key: process.env.CHAT_MODEL,
        };
      }
    }

    if (process.env.EMBEDDING_MODEL && process.env.EMBEDDING_PROVIDER_TYPE) {
      const provider = this.currentConfig.modelProviders.find(
        (p) =>
          p.type === process.env.EMBEDDING_PROVIDER_TYPE &&
          (!process.env.EMBEDDING_PROVIDER_URL ||
            p.config.baseURL === process.env.EMBEDDING_PROVIDER_URL),
      );

      if (provider) {
        this.currentConfig.defaultEmbeddingModel = {
          providerId: provider.id,
          key: process.env.EMBEDDING_MODEL,
        };
      }
    }

    if (
      this.currentConfig.search.searxngURL &&
      this.currentConfig.defaultChatModel &&
      this.currentConfig.defaultEmbeddingModel
    ) {
      this.currentConfig.setupComplete = true;
    }

    this.saveConfig();
  }

  public getConfig(key: string, defaultValue?: any): any {
    const nested = key.split('.');
    let obj: any = this.currentConfig;

    for (let i = 0; i < nested.length; i++) {
      const part = nested[i];
      if (obj == null) return defaultValue;

      obj = obj[part];
    }

    return obj === undefined ? defaultValue : obj;
  }

  public updateConfig(key: string, val: any) {
    const parts = key.split('.');
    if (parts.length === 0) return;

    let target: any = this.currentConfig;
    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i];
      if (target[part] === null || typeof target[part] !== 'object') {
        target[part] = {};
      }

      target = target[part];
    }

    const finalKey = parts[parts.length - 1];
    target[finalKey] = val;

    this.saveConfig();
  }

  public addModelProvider(type: string, name: string, config: any) {
    const newModelProvider: ConfigModelProvider = {
      id: crypto.randomUUID(),
      name,
      type,
      config,
      chatModels: [],
      embeddingModels: [],
      hash: hashObj(config),
    };

    this.currentConfig.modelProviders.push(newModelProvider);
    this.saveConfig();

    return newModelProvider;
  }

  public removeModelProvider(id: string) {
    const index = this.currentConfig.modelProviders.findIndex(
      (p) => p.id === id,
    );

    if (index === -1) return;

    this.currentConfig.modelProviders =
      this.currentConfig.modelProviders.filter((p) => p.id !== id);

    this.saveConfig();
  }

  public async updateModelProvider(id: string, name: string, config: any) {
    const provider = this.currentConfig.modelProviders.find((p) => {
      return p.id === id;
    });

    if (!provider) throw new Error('Provider not found');

    provider.name = name;
    provider.config = config;

    this.saveConfig();

    return provider;
  }

  public addProviderModel(
    providerId: string,
    type: 'embedding' | 'chat',
    model: any,
  ) {
    const provider = this.currentConfig.modelProviders.find(
      (p) => p.id === providerId,
    );

    if (!provider) throw new Error('Invalid provider id');

    delete model.type;

    if (type === 'chat') {
      provider.chatModels.push(model);
    } else {
      provider.embeddingModels.push(model);
    }

    this.saveConfig();

    return model;
  }

  public removeProviderModel(
    providerId: string,
    type: 'embedding' | 'chat',
    modelKey: string,
  ) {
    const provider = this.currentConfig.modelProviders.find(
      (p) => p.id === providerId,
    );

    if (!provider) throw new Error('Invalid provider id');

    if (type === 'chat') {
      provider.chatModels = provider.chatModels.filter(
        (m) => m.key !== modelKey,
      );
    } else {
      provider.embeddingModels = provider.embeddingModels.filter(
        (m) => m.key != modelKey,
      );
    }

    this.saveConfig();
  }

  public isSetupComplete() {
    return (
      process.env.SETUP_COMPLETE === 'true' || this.currentConfig.setupComplete
    );
  }

  public markSetupComplete() {
    if (!this.currentConfig.setupComplete) {
      this.currentConfig.setupComplete = true;
    }

    process.env.SETUP_COMPLETE = 'true';

    this.saveConfig();
  }

  public getUIConfigSections(): UIConfigSections {
    return this.uiConfigSections;
  }

  public getCurrentConfig(): Config {
    return JSON.parse(JSON.stringify(this.currentConfig));
  }

  public getEnvVars(): string[] {
    const envVars: string[] = [];

    envVars.push('    environment:');

    envVars.push('      # SearXNG search engine base URL');
    const searxngURL = this.currentConfig.search.searxngURL;
    if (searxngURL) {
      envVars.push(`      - SEARCH_SEARXNG_URL=${searxngURL}`);
    }

    // Default Models
    if (this.currentConfig.defaultChatModel) {
      const provider = this.currentConfig.modelProviders.find(
        (p) => p.id === this.currentConfig.defaultChatModel?.providerId,
      );
      if (provider) {
        envVars.push('      # Default Chat Model');
        envVars.push(`      - CHAT_PROVIDER_TYPE=${provider.type}`);
        if (provider.config.baseURL) {
          envVars.push(`      - CHAT_PROVIDER_URL=${provider.config.baseURL}`);
        }
        envVars.push(`      - CHAT_MODEL=${this.currentConfig.defaultChatModel.key}`);
      }
    }

    if (this.currentConfig.defaultEmbeddingModel) {
      const provider = this.currentConfig.modelProviders.find(
        (p) => p.id === this.currentConfig.defaultEmbeddingModel?.providerId,
      );
      if (provider) {
        envVars.push('      # Default Embedding Model');
        envVars.push(`      - EMBEDDING_PROVIDER_TYPE=${provider.type}`);
        if (provider.config.baseURL) {
          envVars.push(`      - EMBEDDING_PROVIDER_URL=${provider.config.baseURL}`);
        }
        envVars.push(
          `      - EMBEDDING_MODEL=${this.currentConfig.defaultEmbeddingModel.key}`,
        );
      }
    }

    // Providers configuration
    this.currentConfig.modelProviders.forEach((p) => {
      const providerFields = this.uiConfigSections.modelProviders.find(
        (section) => section.key === p.type,
      )?.fields;
      if (providerFields) {
        envVars.push(`      # ${p.name} Provider Configuration`);
        providerFields.forEach((f) => {
          const val = p.config[f.key];
          if (val && f.env) {
            envVars.push(`      - ${f.env}=${val}`);
          }
        });
      }
    });

    // Preferences (Optional)
    envVars.push('      # Preferences (Optional)');
    envVars.push('      # Acceptable values for PREFERENCES_THEME: light, dark');
    this.uiConfigSections.preferences.forEach((f: any) => {
      const keySnakeCase = f.key
        .replace(/([a-z])([A-Z])/g, '$1_$2')
        .toUpperCase();
      const structuredKey = `PREFERENCES_${keySnakeCase}`;
      const val = this.currentConfig.preferences[f.key];
      if (val !== undefined && val !== '') {
        envVars.push(`      - ${structuredKey}=${val}`);
      }
    });

    // Personalization (Optional)
//    envVars.push('      # Personalization (Optional)');
    this.uiConfigSections.personalization.forEach((f: any) => {
      const keySnakeCase = f.key
        .replace(/([a-z])([A-Z])/g, '$1_$2')
        .toUpperCase();
      const structuredKey = `PERSONALIZATION_${keySnakeCase}`;
      const val = this.currentConfig.personalization[f.key];
      if (val !== undefined && val !== '') {
        envVars.push(`      - ${structuredKey}=${val}`);
      }
    });

    if (this.currentConfig.setupComplete) {
      envVars.push('      - SETUP_COMPLETE=true');
    }

    return envVars;
  }
}

const configManager = new ConfigManager();

export default configManager;
