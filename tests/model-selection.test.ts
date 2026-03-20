/**
 * Tests for model selection logic:
 * - Provider/model value parsing (providerId/modelKey format)
 * - localStorage persistence for selected models
 * - Model restriction filtering
 * - Provider GET endpoint model filtering
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

// --- Model selection value parsing ---

describe('Model selection: value parsing', () => {
  // The format used by ModelSelect.tsx: "{providerId}/{modelKey}"
  function parseModelValue(value: string) {
    const providerId = value.split('/')[0];
    const modelKey = value.split('/').slice(1).join('/');
    return { providerId, modelKey };
  }

  it('parses simple model key', () => {
    const result = parseModelValue('prov-123/gpt-4o');
    expect(result.providerId).toBe('prov-123');
    expect(result.modelKey).toBe('gpt-4o');
  });

  it('parses model key with slashes (openrouter format)', () => {
    const result = parseModelValue(
      'prov-456/anthropic/claude-3.5-sonnet',
    );
    expect(result.providerId).toBe('prov-456');
    expect(result.modelKey).toBe('anthropic/claude-3.5-sonnet');
  });

  it('parses model key with multiple slashes', () => {
    const result = parseModelValue('p1/org/model/variant');
    expect(result.providerId).toBe('p1');
    expect(result.modelKey).toBe('org/model/variant');
  });

  it('handles empty model key', () => {
    const result = parseModelValue('prov-123/');
    expect(result.providerId).toBe('prov-123');
    expect(result.modelKey).toBe('');
  });
});

// --- Model selection localStorage persistence ---

describe('Model selection: localStorage persistence', () => {
  let storage: Record<string, string>;

  beforeEach(() => {
    storage = {};
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => storage[key] ?? null,
      setItem: (key: string, value: string) => {
        storage[key] = value;
      },
    });
  });

  const chatKeys = {
    providerId: 'chatModelProviderId',
    modelKey: 'chatModelKey',
  };

  const embeddingKeys = {
    providerId: 'embeddingModelProviderId',
    modelKey: 'embeddingModelKey',
  };

  function saveModelSelection(
    type: 'chat' | 'embedding',
    providerId: string,
    modelKey: string,
  ) {
    const keys = type === 'chat' ? chatKeys : embeddingKeys;
    localStorage.setItem(keys.providerId, providerId);
    localStorage.setItem(keys.modelKey, modelKey);
  }

  function loadModelSelection(type: 'chat' | 'embedding') {
    const keys = type === 'chat' ? chatKeys : embeddingKeys;
    return `${localStorage.getItem(keys.providerId)}/${localStorage.getItem(keys.modelKey)}`;
  }

  it('persists chat model selection', () => {
    saveModelSelection('chat', 'prov-1', 'gpt-4o');
    expect(localStorage.getItem('chatModelProviderId')).toBe('prov-1');
    expect(localStorage.getItem('chatModelKey')).toBe('gpt-4o');
  });

  it('persists embedding model selection', () => {
    saveModelSelection('embedding', 'prov-2', 'text-embed-3');
    expect(localStorage.getItem('embeddingModelProviderId')).toBe('prov-2');
    expect(localStorage.getItem('embeddingModelKey')).toBe('text-embed-3');
  });

  it('round-trips chat model selection', () => {
    saveModelSelection('chat', 'prov-1', 'gpt-4o');
    expect(loadModelSelection('chat')).toBe('prov-1/gpt-4o');
  });

  it('round-trips embedding model selection', () => {
    saveModelSelection('embedding', 'prov-2', 'text-embed-3');
    expect(loadModelSelection('embedding')).toBe('prov-2/text-embed-3');
  });

  it('handles model keys with slashes', () => {
    saveModelSelection('chat', 'prov-1', 'anthropic/claude-3.5-sonnet');
    expect(localStorage.getItem('chatModelKey')).toBe(
      'anthropic/claude-3.5-sonnet',
    );
    // Note: loadModelSelection returns "prov-1/anthropic/claude-3.5-sonnet"
    // The parse logic must use split('/')[0] and split('/').slice(1).join('/')
  });

  it('returns null/null when no selection saved', () => {
    expect(loadModelSelection('chat')).toBe('null/null');
  });
});

// --- Model restriction filtering ---

describe('Model restriction: filtering logic', () => {
  type Model = { key: string; name: string };
  type Provider = {
    id: string;
    name: string;
    chatModels: Model[];
    embeddingModels: Model[];
  };
  type RestrictedModel = { providerId: string; modelKey: string };

  // Reproduces the exact filtering logic from GET /api/providers
  function filterRestrictedModels(
    providers: Provider[],
    restricted: RestrictedModel[],
  ): Provider[] {
    if (restricted.length === 0) return providers;
    return providers.map((p) => ({
      ...p,
      chatModels: p.chatModels.filter(
        (m) =>
          !restricted.some(
            (r) => r.providerId === p.id && r.modelKey === m.key,
          ),
      ),
    }));
  }

  const providers: Provider[] = [
    {
      id: 'prov-1',
      name: 'OpenAI',
      chatModels: [
        { key: 'gpt-4o', name: 'GPT-4o' },
        { key: 'gpt-4o-mini', name: 'GPT-4o Mini' },
        { key: 'o1', name: 'O1' },
      ],
      embeddingModels: [
        { key: 'text-embedding-3-small', name: 'Embed Small' },
      ],
    },
    {
      id: 'prov-2',
      name: 'Anthropic',
      chatModels: [
        { key: 'claude-3.5-sonnet', name: 'Claude 3.5 Sonnet' },
        { key: 'claude-3-haiku', name: 'Claude 3 Haiku' },
      ],
      embeddingModels: [],
    },
  ];

  it('returns all models when no restrictions', () => {
    const result = filterRestrictedModels(providers, []);
    expect(result[0].chatModels).toHaveLength(3);
    expect(result[1].chatModels).toHaveLength(2);
  });

  it('filters out restricted models from correct provider', () => {
    const restricted = [{ providerId: 'prov-1', modelKey: 'o1' }];
    const result = filterRestrictedModels(providers, restricted);
    expect(result[0].chatModels).toHaveLength(2);
    expect(result[0].chatModels.map((m) => m.key)).toEqual([
      'gpt-4o',
      'gpt-4o-mini',
    ]);
    // Other provider unaffected
    expect(result[1].chatModels).toHaveLength(2);
  });

  it('filters multiple models from same provider', () => {
    const restricted = [
      { providerId: 'prov-1', modelKey: 'gpt-4o' },
      { providerId: 'prov-1', modelKey: 'o1' },
    ];
    const result = filterRestrictedModels(providers, restricted);
    expect(result[0].chatModels).toHaveLength(1);
    expect(result[0].chatModels[0].key).toBe('gpt-4o-mini');
  });

  it('filters models across providers', () => {
    const restricted = [
      { providerId: 'prov-1', modelKey: 'o1' },
      { providerId: 'prov-2', modelKey: 'claude-3-haiku' },
    ];
    const result = filterRestrictedModels(providers, restricted);
    expect(result[0].chatModels).toHaveLength(2);
    expect(result[1].chatModels).toHaveLength(1);
    expect(result[1].chatModels[0].key).toBe('claude-3.5-sonnet');
  });

  it('does not affect embedding models', () => {
    const restricted = [
      { providerId: 'prov-1', modelKey: 'text-embedding-3-small' },
    ];
    const result = filterRestrictedModels(providers, restricted);
    // Embedding models are NOT filtered by this logic
    expect(result[0].embeddingModels).toHaveLength(1);
  });

  it('ignores restrictions for non-existent providers', () => {
    const restricted = [
      { providerId: 'nonexistent', modelKey: 'gpt-4o' },
    ];
    const result = filterRestrictedModels(providers, restricted);
    expect(result[0].chatModels).toHaveLength(3);
  });

  it('ignores restrictions for non-existent models', () => {
    const restricted = [
      { providerId: 'prov-1', modelKey: 'nonexistent-model' },
    ];
    const result = filterRestrictedModels(providers, restricted);
    expect(result[0].chatModels).toHaveLength(3);
  });

  it('can restrict all models from a provider', () => {
    const restricted = [
      { providerId: 'prov-2', modelKey: 'claude-3.5-sonnet' },
      { providerId: 'prov-2', modelKey: 'claude-3-haiku' },
    ];
    const result = filterRestrictedModels(providers, restricted);
    expect(result[1].chatModels).toHaveLength(0);
  });
});

// --- Error model filtering ---

describe('Provider list: error model filtering', () => {
  type Model = { key: string; name: string };
  type Provider = {
    id: string;
    name: string;
    chatModels: Model[];
    embeddingModels: Model[];
  };

  // Reproduces the error filtering from GET /api/providers
  function filterErrorProviders(providers: Provider[]): Provider[] {
    return providers.filter((p) => {
      return !p.chatModels.some((m) => m.key === 'error');
    });
  }

  it('keeps providers with valid models', () => {
    const providers: Provider[] = [
      {
        id: 'p1',
        name: 'Good',
        chatModels: [{ key: 'gpt-4o', name: 'GPT-4o' }],
        embeddingModels: [],
      },
    ];
    expect(filterErrorProviders(providers)).toHaveLength(1);
  });

  it('removes providers with error models', () => {
    const providers: Provider[] = [
      {
        id: 'p1',
        name: 'Broken',
        chatModels: [{ key: 'error', name: 'API key invalid' }],
        embeddingModels: [],
      },
      {
        id: 'p2',
        name: 'Good',
        chatModels: [{ key: 'gpt-4o', name: 'GPT-4o' }],
        embeddingModels: [],
      },
    ];
    const result = filterErrorProviders(providers);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('p2');
  });

  it('keeps providers with empty model lists', () => {
    const providers: Provider[] = [
      { id: 'p1', name: 'Empty', chatModels: [], embeddingModels: [] },
    ];
    expect(filterErrorProviders(providers)).toHaveLength(1);
  });
});
