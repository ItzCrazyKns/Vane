import { describe, expect, it, vi } from 'vitest';

/* ConfigManager writes DATA_DIR/data/config.json when imported. */
vi.hoisted(() => {
  const fs = require('node:fs');
  const os = require('node:os');
  const path = require('node:path');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vane-sec-'));
  fs.mkdirSync(path.join(dir, 'data'));
  process.env.DATA_DIR = dir;
});

import configManager from '@/lib/config';
import {
  SECRET_MASK,
  maskConfig,
  maskProvider,
  restoreMaskedProviderSecrets,
} from '@/lib/config/secrets';
import { checkApiRequest, isHostAllowed } from '@/lib/security/requestGuard';
import {
  BlockedURLError,
  assertPublicHttpURL,
  fetchPublicURL,
  isBlockedAddress,
} from '@/lib/security/urlGuard';

describe('checkApiRequest', () => {
  const base = { method: 'POST', host: 'localhost:3000' };

  it('blocks a cross-site text/plain style POST to /api/config', () => {
    expect(
      checkApiRequest({
        ...base,
        origin: 'https://evil.test',
        secFetchSite: 'cross-site',
      }),
    ).toEqual({ status: 403, message: 'Cross-origin request blocked.' });
  });

  it('blocks a cross-site POST that sends no Origin', () => {
    expect(
      checkApiRequest({ ...base, secFetchSite: 'cross-site' })?.status,
    ).toBe(403);
    expect(checkApiRequest({ ...base, origin: 'null' })?.status).toBe(403);
  });

  it('allows the app itself, GETs and non-browser clients', () => {
    expect(
      checkApiRequest({
        ...base,
        origin: 'http://localhost:3000',
        secFetchSite: 'same-origin',
      }),
    ).toBeNull();
    expect(
      checkApiRequest({ ...base, method: 'GET', origin: 'https://evil.test' }),
    ).toBeNull();
    expect(checkApiRequest(base)).toBeNull();
  });

  it('accepts the origin a reverse proxy forwards', () => {
    expect(
      checkApiRequest({
        method: 'POST',
        host: 'vane:3000',
        forwardedHost: 'vane.example.com',
        origin: 'https://vane.example.com',
        allowedHosts: 'vane.example.com',
      }),
    ).toBeNull();
  });

  it('blocks DNS rebinding through a public name, even for GET', () => {
    expect(
      checkApiRequest({ method: 'GET', host: 'rebind.evil.test:3000' })?.status,
    ).toBe(403);
  });
});

describe('isHostAllowed', () => {
  it('allows local names and IP literals', () => {
    for (const h of [
      'localhost:3000',
      '127.0.0.1:3000',
      '[::1]:3000',
      '192.168.0.10',
      'vane:3000',
      'nas.local',
      'host.docker.internal:3000',
    ]) {
      expect(isHostAllowed(h), h).toBe(true);
    }
  });

  it('needs VANE_ALLOWED_HOSTS for public domains', () => {
    expect(isHostAllowed('vane.example.com')).toBe(false);
    expect(isHostAllowed('vane.example.com', 'vane.example.com')).toBe(true);
    expect(isHostAllowed('a.example.com', '*.example.com')).toBe(true);
    expect(isHostAllowed('example.com.evil.test', '*.example.com')).toBe(false);
    expect(isHostAllowed('anything.test', '*')).toBe(true);
  });
});

describe('POST /api/config validation', () => {
  it('refuses paths into model providers and undeclared keys', () => {
    expect(
      configManager.validateUIConfigWrite(
        'modelProviders.0.config.baseURL',
        'https://evil.test',
      ),
    ).toMatch(/Invalid config key/);
    expect(configManager.validateUIConfigWrite('setupComplete', true)).toMatch(
      /Invalid config key/,
    );
    expect(
      configManager.validateUIConfigWrite('search.somethingElse', 'x'),
    ).toMatch(/Invalid config key/);
    /* client-scoped fields live in localStorage, not config.json */
    expect(
      configManager.validateUIConfigWrite('preferences.theme', 'dark'),
    ).toMatch(/Invalid config key/);
  });

  it('checks value types', () => {
    expect(
      configManager.validateUIConfigWrite('bifrost.enabled', 'yes'),
    ).toMatch(/Invalid value/);
    expect(
      configManager.validateUIConfigWrite('search.provider', 'bing'),
    ).toMatch(/Invalid value/);
  });

  it('accepts the fields the settings UI writes', () => {
    expect(
      configManager.validateUIConfigWrite('search.searxngURL', 'http://s:8080'),
    ).toBeNull();
    expect(
      configManager.validateUIConfigWrite('bifrost.enabled', true),
    ).toBeNull();
    expect(
      configManager.validateUIConfigWrite('search.provider', 'firecrawl'),
    ).toBeNull();
  });

  it('keeps a stored secret when the mask comes back', () => {
    configManager.updateUIConfig('bifrost.virtualKey', 'sk-bf-real');
    configManager.updateUIConfig('bifrost.virtualKey', SECRET_MASK);
    expect(configManager.getConfig('bifrost.virtualKey', '')).toBe(
      'sk-bf-real',
    );
  });
});

describe('secret masking', () => {
  const provider = {
    id: 'p1',
    name: 'OpenAI',
    type: 'openai',
    config: { apiKey: 'sk-live-123', baseURL: 'https://api.openai.com/v1' },
    chatModels: [],
    embeddingModels: [],
    hash: 'h',
  };

  it('masks provider API keys and password fields', () => {
    const masked = maskConfig(
      {
        version: 1,
        setupComplete: true,
        preferences: {},
        personalization: {},
        modelProviders: [provider],
        search: { searxngURL: 'http://s' },
        bifrost: { virtualKey: 'sk-bf-1', url: 'http://gw' },
      },
      configManager.getUIConfigSections(),
    );

    expect(masked.modelProviders[0].config).toEqual({
      apiKey: SECRET_MASK,
      baseURL: 'https://api.openai.com/v1',
    });
    expect(masked.bifrost).toEqual({
      virtualKey: SECRET_MASK,
      url: 'http://gw',
    });
    expect(JSON.stringify(masked)).not.toMatch(/sk-live-123|sk-bf-1/);
    expect(provider.config.apiKey).toBe('sk-live-123');
  });

  it('leaves empty secrets empty so the UI shows the field as unset', () => {
    expect(
      maskProvider({ ...provider, config: { apiKey: '' } }).config.apiKey,
    ).toBe('');
  });

  it('restores masked keys when a provider is updated', () => {
    expect(
      restoreMaskedProviderSecrets(
        'openai',
        { apiKey: SECRET_MASK, baseURL: 'http://new' },
        provider.config,
      ),
    ).toEqual({ apiKey: 'sk-live-123', baseURL: 'http://new' });
    expect(
      restoreMaskedProviderSecrets(
        'openai',
        { apiKey: 'sk-new' },
        provider.config,
      ),
    ).toEqual({ apiKey: 'sk-new' });
  });
});

describe('isBlockedAddress', () => {
  it('blocks loopback, private, link-local and metadata addresses', () => {
    for (const ip of [
      '127.0.0.1',
      '10.1.2.3',
      '172.20.0.5',
      '192.168.1.1',
      '169.254.169.254',
      '100.64.0.1',
      '0.0.0.0',
      '::1',
      '::',
      'fd00::1',
      'fe80::1',
      '::ffff:127.0.0.1',
      '::ffff:7f00:1',
      '64:ff9b::a9fe:a9fe',
    ]) {
      expect(isBlockedAddress(ip), ip).toBe(true);
    }
  });

  it('allows public addresses', () => {
    for (const ip of [
      '93.184.216.34',
      '8.8.8.8',
      '2606:4700::1111',
      '::ffff:8.8.8.8',
    ]) {
      expect(isBlockedAddress(ip), ip).toBe(false);
    }
  });
});

describe('assertPublicHttpURL', () => {
  const resolveTo = (address: string) => async () => [{ address, family: 4 }];

  it('refuses internal targets and non-http schemes', async () => {
    await expect(
      assertPublicHttpURL('http://127.0.0.1:3000/api/config'),
    ).rejects.toThrow(BlockedURLError);
    await expect(assertPublicHttpURL('http://[::1]/')).rejects.toThrow(
      BlockedURLError,
    );
    await expect(assertPublicHttpURL('file:///etc/passwd')).rejects.toThrow(
      /scheme/,
    );
    await expect(
      assertPublicHttpURL(
        'http://metadata.evil.test/',
        resolveTo('169.254.169.254'),
      ),
    ).rejects.toThrow(/private or local/);
  });

  it('accepts public hosts and honours VANE_ALLOW_PRIVATE_URLS', async () => {
    await expect(
      assertPublicHttpURL('https://news.test/a', resolveTo('93.184.216.34')),
    ).resolves.toBeInstanceOf(URL);

    process.env.VANE_ALLOW_PRIVATE_URLS = 'true';
    try {
      await expect(
        assertPublicHttpURL('http://10.0.0.5/wiki'),
      ).resolves.toBeInstanceOf(URL);
    } finally {
      delete process.env.VANE_ALLOW_PRIVATE_URLS;
    }
  });

  it('re-checks every redirect hop', async () => {
    const fetchMock = vi.fn(
      async () =>
        new Response(null, {
          status: 302,
          headers: { location: 'http://127.0.0.1/admin' },
        }),
    );
    vi.stubGlobal('fetch', fetchMock);
    try {
      await expect(
        fetchPublicURL('https://news.test/a', {}, resolveTo('93.184.216.34')),
      ).rejects.toThrow(BlockedURLError);
      expect(fetchMock).toHaveBeenCalledTimes(1);
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
