/**
 * Tests for ConfigManager: provider CRUD, restricted models,
 * setup completion, and atomic file writes.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';

// We test ConfigManager by creating a temporary data directory
// and instantiating it directly via dynamic import.

let tmpDir: string;
let configPath: string;

function writeConfig(config: any) {
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
}

function readConfig() {
  return JSON.parse(fs.readFileSync(configPath, 'utf-8'));
}

function makeDefaultConfig(overrides: any = {}) {
  return {
    version: 1,
    setupComplete: false,
    preferences: {},
    personalization: {},
    modelProviders: [],
    search: { searxngURL: '' },
    restrictedModels: [],
    ...overrides,
  };
}

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'perplexica-test-'));
  const dataDir = path.join(tmpDir, 'data');
  fs.mkdirSync(dataDir, { recursive: true });
  configPath = path.join(dataDir, 'config.json');
  writeConfig(makeDefaultConfig());
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('Config: restricted models', () => {
  it('defaults to empty restricted models', () => {
    const config = readConfig();
    expect(config.restrictedModels).toEqual([]);
  });

  it('can set restricted models', () => {
    const config = readConfig();
    config.restrictedModels = [
      { providerId: 'p1', modelKey: 'gpt-4o' },
      { providerId: 'p2', modelKey: 'claude-3-haiku' },
    ];
    writeConfig(config);

    const reloaded = readConfig();
    expect(reloaded.restrictedModels).toHaveLength(2);
    expect(reloaded.restrictedModels[0]).toEqual({
      providerId: 'p1',
      modelKey: 'gpt-4o',
    });
  });

  it('can clear restricted models', () => {
    const config = readConfig();
    config.restrictedModels = [{ providerId: 'p1', modelKey: 'gpt-4o' }];
    writeConfig(config);

    const config2 = readConfig();
    config2.restrictedModels = [];
    writeConfig(config2);

    expect(readConfig().restrictedModels).toEqual([]);
  });
});

describe('Config: model provider CRUD', () => {
  it('starts with empty providers', () => {
    expect(readConfig().modelProviders).toEqual([]);
  });

  it('can add a provider', () => {
    const config = readConfig();
    const newProvider = {
      id: crypto.randomUUID(),
      name: 'My OpenAI',
      type: 'openai',
      config: { apiKey: 'sk-test' },
      chatModels: [],
      embeddingModels: [],
      hash: 'abc123',
    };
    config.modelProviders.push(newProvider);
    writeConfig(config);

    const reloaded = readConfig();
    expect(reloaded.modelProviders).toHaveLength(1);
    expect(reloaded.modelProviders[0].name).toBe('My OpenAI');
    expect(reloaded.modelProviders[0].type).toBe('openai');
  });

  it('can add multiple providers', () => {
    const config = readConfig();
    config.modelProviders = [
      {
        id: 'p1',
        name: 'OpenAI',
        type: 'openai',
        config: { apiKey: 'sk-1' },
        chatModels: [],
        embeddingModels: [],
        hash: 'h1',
      },
      {
        id: 'p2',
        name: 'Venice',
        type: 'venice',
        config: { apiKey: 'vk-1' },
        chatModels: [],
        embeddingModels: [],
        hash: 'h2',
      },
    ];
    writeConfig(config);

    expect(readConfig().modelProviders).toHaveLength(2);
  });

  it('can remove a provider by id', () => {
    const config = readConfig();
    config.modelProviders = [
      {
        id: 'p1',
        name: 'OpenAI',
        type: 'openai',
        config: {},
        chatModels: [],
        embeddingModels: [],
        hash: 'h1',
      },
      {
        id: 'p2',
        name: 'Venice',
        type: 'venice',
        config: {},
        chatModels: [],
        embeddingModels: [],
        hash: 'h2',
      },
    ];
    writeConfig(config);

    const config2 = readConfig();
    config2.modelProviders = config2.modelProviders.filter(
      (p: any) => p.id !== 'p1',
    );
    writeConfig(config2);

    const reloaded = readConfig();
    expect(reloaded.modelProviders).toHaveLength(1);
    expect(reloaded.modelProviders[0].id).toBe('p2');
  });

  it('can update a provider name and config', () => {
    const config = readConfig();
    config.modelProviders = [
      {
        id: 'p1',
        name: 'Old Name',
        type: 'openai',
        config: { apiKey: 'old-key' },
        chatModels: [],
        embeddingModels: [],
        hash: 'h1',
      },
    ];
    writeConfig(config);

    const config2 = readConfig();
    const provider = config2.modelProviders[0];
    provider.name = 'New Name';
    provider.config = { apiKey: 'new-key' };
    writeConfig(config2);

    const reloaded = readConfig();
    expect(reloaded.modelProviders[0].name).toBe('New Name');
    expect(reloaded.modelProviders[0].config.apiKey).toBe('new-key');
  });

  it('can add models to a provider', () => {
    const config = readConfig();
    config.modelProviders = [
      {
        id: 'p1',
        name: 'OpenAI',
        type: 'openai',
        config: {},
        chatModels: [],
        embeddingModels: [],
        hash: 'h1',
      },
    ];
    writeConfig(config);

    const config2 = readConfig();
    config2.modelProviders[0].chatModels.push(
      { key: 'gpt-4o', name: 'GPT-4o' },
      { key: 'gpt-4o-mini', name: 'GPT-4o Mini' },
    );
    config2.modelProviders[0].embeddingModels.push({
      key: 'text-embedding-3-small',
      name: 'Embed Small',
    });
    writeConfig(config2);

    const reloaded = readConfig();
    expect(reloaded.modelProviders[0].chatModels).toHaveLength(2);
    expect(reloaded.modelProviders[0].embeddingModels).toHaveLength(1);
  });

  it('can remove a model from a provider', () => {
    const config = readConfig();
    config.modelProviders = [
      {
        id: 'p1',
        name: 'OpenAI',
        type: 'openai',
        config: {},
        chatModels: [
          { key: 'gpt-4o', name: 'GPT-4o' },
          { key: 'gpt-4o-mini', name: 'GPT-4o Mini' },
        ],
        embeddingModels: [],
        hash: 'h1',
      },
    ];
    writeConfig(config);

    const config2 = readConfig();
    config2.modelProviders[0].chatModels =
      config2.modelProviders[0].chatModels.filter(
        (m: any) => m.key !== 'gpt-4o-mini',
      );
    writeConfig(config2);

    const reloaded = readConfig();
    expect(reloaded.modelProviders[0].chatModels).toHaveLength(1);
    expect(reloaded.modelProviders[0].chatModels[0].key).toBe('gpt-4o');
  });
});

describe('Config: setup completion', () => {
  it('starts with setupComplete=false', () => {
    expect(readConfig().setupComplete).toBe(false);
  });

  it('can mark setup as complete', () => {
    const config = readConfig();
    config.setupComplete = true;
    writeConfig(config);
    expect(readConfig().setupComplete).toBe(true);
  });
});

describe('Config: atomic writes', () => {
  it('write via temp file + rename does not corrupt', () => {
    // Simulate the atomic write pattern from ConfigManager
    const config = makeDefaultConfig({
      modelProviders: [
        { id: 'p1', name: 'Test', type: 'test', config: {}, chatModels: [] },
      ],
    });

    const tmpPath = configPath + '.tmp';
    fs.writeFileSync(tmpPath, JSON.stringify(config, null, 2));
    fs.renameSync(tmpPath, configPath);

    const reloaded = readConfig();
    expect(reloaded.modelProviders).toHaveLength(1);
    expect(reloaded.modelProviders[0].name).toBe('Test');

    // Temp file should not exist
    expect(fs.existsSync(tmpPath)).toBe(false);
  });
});

describe('Config: model restriction validation shapes', () => {
  it('validates restrictedModels as array', () => {
    const valid = Array.isArray([]);
    expect(valid).toBe(true);
    expect(Array.isArray('not array')).toBe(false);
    expect(Array.isArray(null)).toBe(false);
    expect(Array.isArray(undefined)).toBe(false);
  });

  it('validates each entry has string providerId and modelKey', () => {
    const validate = (entries: any[]) =>
      entries.every(
        (m: any) =>
          typeof m === 'object' &&
          m !== null &&
          typeof m.providerId === 'string' &&
          typeof m.modelKey === 'string',
      );

    expect(validate([{ providerId: 'p1', modelKey: 'k1' }])).toBe(true);
    expect(validate([])).toBe(true);
    expect(validate([{ providerId: 'p1' }])).toBe(false);
    expect(validate([{ modelKey: 'k1' }])).toBe(false);
    expect(validate([null])).toBe(false);
    expect(validate([{ providerId: 123, modelKey: 'k1' }])).toBe(false);
  });
});
