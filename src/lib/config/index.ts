import path from 'node:path';
import fs from 'fs';
import { Config, ConfigModelProvider, UIConfigSections } from './types';
import { hashObj } from '../utils/hash';
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
      provider: '',
      searxngURL: '',
      firecrawlURL: '',
    },
    bifrost: {},
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
      {
        name: 'Discover article click',
        key: 'discoverClickAction',
        type: 'select',
        options: [
          {
            name: 'Summarize with AI',
            value: 'summarize',
          },
          {
            name: 'Open the article',
            value: 'open',
          },
        ],
        required: false,
        description:
          'What happens when you click an article in Discover or in the news widget.',
        default: 'summarize',
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
        name: 'Search Provider',
        key: 'provider',
        type: 'select',
        options: [
          {
            name: 'SearXNG',
            value: 'searxng',
          },
          {
            name: 'Firecrawl',
            value: 'firecrawl',
          },
        ],
        required: false,
        description:
          'Engine used for web searches. Firecrawl needs the Firecrawl URL below.',
        default: 'searxng',
        scope: 'server',
        env: 'SEARCH_PROVIDER',
      },
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
      {
        name: 'Firecrawl URL',
        key: 'firecrawlURL',
        type: 'string',
        required: false,
        description:
          'Base URL of your Firecrawl API, without /v2. Used for web search when Firecrawl is the provider, and for reading pages.',
        placeholder: 'http://localhost:3002',
        default: '',
        scope: 'server',
        env: 'FIRECRAWL_API_URL',
      },
    ],
    bifrost: [
      {
        name: 'Use Bifrost',
        key: 'enabled',
        type: 'switch',
        required: false,
        description:
          'Route models through a Bifrost gateway. Its models appear as the "Bifrost" provider in the model picker.',
        default: false,
        scope: 'server',
        env: 'BIFROST_ENABLED',
      },
      {
        name: 'Bifrost URL',
        key: 'url',
        type: 'string',
        required: false,
        description:
          'Base URL of your Bifrost gateway, without /v1. Vane calls /v1/models, /v1/chat/completions and /mcp under it.',
        placeholder: 'http://localhost:8080',
        default: '',
        scope: 'server',
        env: 'BIFROST_URL',
      },
      {
        name: 'Bifrost Virtual Key',
        key: 'virtualKey',
        type: 'password',
        required: false,
        description:
          'Sent as x-bf-vk. Leave empty if your gateway does not require a virtual key.',
        placeholder: 'sk-bf-...',
        default: '',
        scope: 'server',
        env: 'BIFROST_VIRTUAL_KEY',
      },
      {
        name: 'Use Bifrost MCP tools',
        key: 'mcpEnabled',
        type: 'switch',
        required: false,
        description:
          'Let the researcher call tools from the MCP servers connected to Bifrost (through its /mcp endpoint).',
        default: false,
        scope: 'server',
        env: 'BIFROST_MCP_ENABLED',
      },
      {
        name: 'Allowed MCP tools',
        key: 'mcpTools',
        type: 'string',
        required: false,
        description:
          'Comma-separated tool names, * works as a wildcard (e.g. "brave-*,github-search_code"). When empty, only tools marked read-only are used.',
        placeholder: 'brave-*,github-search_code',
        default: '',
        scope: 'server',
        env: 'BIFROST_MCP_TOOLS',
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
    fs.writeFileSync(
      this.configPath,
      JSON.stringify(this.currentConfig, null, 2),
    );
  }

  private initializeConfig() {
    const exists = fs.existsSync(this.configPath);
    if (!exists) {
      fs.writeFileSync(
        this.configPath,
        JSON.stringify(this.currentConfig, null, 2),
      );
    } else {
      try {
        this.currentConfig = JSON.parse(
          fs.readFileSync(this.configPath, 'utf-8'),
        );
      } catch (err) {
        if (err instanceof SyntaxError) {
          console.error(
            `Error parsing config file at ${this.configPath}:`,
            err,
          );
          console.log(
            'Loading default config and overwriting the existing file.',
          );
          fs.writeFileSync(
            this.configPath,
            JSON.stringify(this.currentConfig, null, 2),
          );
          return;
        } else {
          console.log('Unknown error reading config file:', err);
        }
      }

      this.currentConfig = this.migrateConfig(this.currentConfig);
    }
  }

  private migrateConfig(config: Config): Config {
    /* Config files written before a section existed lack its key. */
    if (!config.bifrost || typeof config.bifrost !== 'object') {
      config.bifrost = {};
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

    /* search section */
    this.uiConfigSections.search.forEach((f) => {
      if (f.env && !this.currentConfig.search[f.key]) {
        this.currentConfig.search[f.key] =
          process.env[f.env] ?? f.default ?? '';
      }
    });

    /* bifrost section: env fills keys that are unset or empty. A switch
       turned off in the UI is saved as false, so env never flips it back
       on, and nothing is written when the env var is absent (the build
       also runs this, before the container's env exists). */
    this.uiConfigSections.bifrost.forEach((f) => {
      const fromEnv = f.env ? process.env[f.env] : undefined;
      const current = this.currentConfig.bifrost[f.key];
      if (fromEnv !== undefined && (current === undefined || current === '')) {
        this.currentConfig.bifrost[f.key] =
          f.type === 'switch' ? fromEnv === 'true' : fromEnv;
      }
    });

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

    const forbiddenKeys = ['__proto__', 'constructor', 'prototype'];
    if (parts.some((p) => p === '' || forbiddenKeys.includes(p))) {
      throw new Error(`Invalid config key: ${key}`);
    }

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
    return this.currentConfig.setupComplete;
  }

  public markSetupComplete() {
    if (!this.currentConfig.setupComplete) {
      this.currentConfig.setupComplete = true;
    }

    this.saveConfig();
  }

  public getUIConfigSections(): UIConfigSections {
    return this.uiConfigSections;
  }

  public getCurrentConfig(): Config {
    return JSON.parse(JSON.stringify(this.currentConfig));
  }
}

const configManager = new ConfigManager();

export default configManager;
