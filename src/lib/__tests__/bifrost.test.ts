import { afterEach, describe, expect, it, vi } from 'vitest';

const stored = vi.hoisted(() => ({ value: {} as Record<string, any> }));

vi.mock('@/lib/config', () => ({
  default: {
    getConfig: (key: string, d: any) => (key === 'bifrost' ? stored.value : d),
  },
}));

import {
  getBifrostConfig,
  normalizeBifrostURL,
} from '@/lib/config/serverRegistry';
import {
  bifrostChatHeaders,
  fetchBifrostModels,
  parseBifrostModels,
  BIFROST_NO_INJECTED_TOOLS,
} from '../bifrost';
import BifrostProvider from '../models/providers/bifrost';

afterEach(() => vi.unstubAllGlobals());

describe('getBifrostConfig', () => {
  it('is off without a URL even when the switch is on', () => {
    stored.value = { enabled: true, url: '' };
    expect(getBifrostConfig().enabled).toBe(false);
  });

  it('reads switches saved as booleans or strings and splits the tool list', () => {
    stored.value = {
      enabled: 'true',
      url: ' http://gw:8080/v1/ ',
      virtualKey: ' sk-bf-1 ',
      mcpEnabled: true,
      mcpTools: 'brave-*, github-search_code,,',
    };
    expect(getBifrostConfig()).toEqual({
      enabled: true,
      url: 'http://gw:8080',
      virtualKey: 'sk-bf-1',
      mcpEnabled: true,
      mcpTools: ['brave-*', 'github-search_code'],
    });
  });

  it('strips trailing slashes and /v1', () => {
    expect(normalizeBifrostURL('http://x:8080//')).toBe('http://x:8080');
    expect(normalizeBifrostURL('http://x:8080/v1')).toBe('http://x:8080');
  });
});

describe('Bifrost models', () => {
  it('splits /v1/models into chat and embedding models', () => {
    expect(
      parseBifrostModels({
        data: [
          { id: 'openai/text-embedding-3-small' },
          { id: 'openai/gpt-4o-mini' },
          { id: 'anthropic/claude-sonnet-4-5' },
          { id: 'openai/gpt-4o-mini' },
          { nope: true },
        ],
      }),
    ).toEqual({
      chat: [
        {
          key: 'anthropic/claude-sonnet-4-5',
          name: 'anthropic/claude-sonnet-4-5',
        },
        { key: 'openai/gpt-4o-mini', name: 'openai/gpt-4o-mini' },
      ],
      embedding: [
        {
          key: 'openai/text-embedding-3-small',
          name: 'openai/text-embedding-3-small',
        },
      ],
    });
  });

  it('calls /v1/models with the virtual key', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ data: [{ id: 'openai/gpt-4o' }] })),
      );
    vi.stubGlobal('fetch', fetchMock);

    const list = await fetchBifrostModels({
      url: 'http://gw',
      virtualKey: 'vk',
    });

    expect(fetchMock.mock.calls[0][0]).toBe('http://gw/v1/models');
    expect(fetchMock.mock.calls[0][1].headers).toEqual({ 'x-bf-vk': 'vk' });
    expect(list.chat.map((m) => m.key)).toEqual(['openai/gpt-4o']);
  });

  it('reports gateway errors', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response('denied', { status: 401 })),
    );
    await expect(
      fetchBifrostModels({ url: 'http://gw', virtualKey: '' }),
    ).rejects.toThrow(/401/);
  });

  it('keeps Bifrost from injecting MCP tools into chat requests', () => {
    expect(bifrostChatHeaders({ virtualKey: '' })).toEqual({
      'x-bf-mcp-include-tools': BIFROST_NO_INJECTED_TOOLS,
    });
  });
});

describe('BifrostProvider', () => {
  it('points the OpenAI client at <url>/v1 with the Bifrost headers', async () => {
    const provider = new BifrostProvider('bifrost', 'Bifrost', {
      url: 'http://gw:8080',
      virtualKey: 'vk',
    });
    const llm: any = await provider.loadChatModel(
      'anthropic/claude-sonnet-4-5',
    );

    expect(llm.openAIClient.baseURL).toBe('http://gw:8080/v1');
    expect(llm.config.model).toBe('anthropic/claude-sonnet-4-5');
    expect(llm.config.defaultHeaders['x-bf-vk']).toBe('vk');
  });

  it('requires a URL', () => {
    expect(() => BifrostProvider.parseAndValidate({ url: ' ' })).toThrow();
  });
});
