import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';

// Mock fs to avoid writing to real config file
vi.mock('fs');

describe('ConfigManager', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
    vi.mocked(fs.existsSync).mockReturnValue(false);
    vi.mocked(fs.readFileSync).mockReturnValue('{}');
    vi.mocked(fs.writeFileSync).mockImplementation(() => {});
    vi.mocked(fs.mkdirSync).mockImplementation(() => '');
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.clearAllMocks();
  });

  it('should load default config when no file or env vars exist', async () => {
    const configManager = (await import('./index')).default;
    const config = configManager.getCurrentConfig();
    
    expect(config.preferences.theme).toBe('dark'); 
  });

  it('should override preferences with environment variables', async () => {
    process.env.PREFERENCES_THEME = 'light';
    
    const configManager = (await import('./index')).default;
    const config = configManager.getCurrentConfig();

    expect(config.preferences.theme).toBe('light');
  });

  it('should override search settings with environment variables', async () => {
    process.env.SEARCH_SEARXNG_URL = 'http://test-searxng:8080';
    
    const configManager = (await import('./index')).default;
    const config = configManager.getCurrentConfig();

    expect(config.search.searxngURL).toBe('http://test-searxng:8080');
  });

  it('should prioritize env var over existing config file value', async () => {
    const existingConfig = {
      version: 1,
      setupComplete: true,
      preferences: { theme: 'dark' },
      personalization: {},
      modelProviders: [],
      search: { searxngURL: 'http://original-url' },
    };
    
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(existingConfig));

    process.env.PREFERENCES_THEME = 'light';
    process.env.SEARCH_SEARXNG_URL = 'http://override-url';

    const configManager = (await import('./index')).default;
    const config = configManager.getCurrentConfig();

    expect(config.preferences.theme).toBe('light');
    expect(config.search.searxngURL).toBe('http://override-url');
  });

  it('should respect SETUP_COMPLETE environment variable', async () => {
    process.env.SETUP_COMPLETE = 'true';
    const configManager = (await import('./index')).default;
    expect(configManager.isSetupComplete()).toBe(true);
  });

  it('should generate correct environment variables for export', async () => {
    process.env.PREFERENCES_THEME = 'light';
    process.env.SEARCH_SEARXNG_URL = 'http://test-url';
    
    const configManager = (await import('./index')).default;
    const envVars = configManager.getEnvVars();

    expect(envVars).toContain('      - PREFERENCES_THEME=light');
    expect(envVars).toContain('      - SEARCH_SEARXNG_URL=http://test-url');
  });

  it('should initialize default models from environment variables', async () => {
    // Mock providers to match
    const existingConfig = {
      version: 1,
      setupComplete: true,
      preferences: {},
      personalization: {},
      modelProviders: [
        { id: 'p1', type: 'openai', config: { baseURL: 'https://api.openai.com/v1' } }
      ],
      search: {}
    };
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(existingConfig));

    process.env.CHAT_PROVIDER_TYPE = 'openai';
    process.env.CHAT_PROVIDER_URL = 'https://api.openai.com/v1';
    process.env.CHAT_MODEL = 'gpt-4';

    const configManager = (await import('./index')).default;
    const config = configManager.getCurrentConfig();

    expect(config.defaultChatModel?.providerId).toBe('p1');
    expect(config.defaultChatModel?.key).toBe('gpt-4');
  });
});
