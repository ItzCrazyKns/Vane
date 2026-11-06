import type { BifrostConfig } from './config/serverRegistry';
import type { Model, ModelList } from './models/types';

/** Id of the provider Vane adds to the model picker while Bifrost is on. */
export const BIFROST_PROVIDER_ID = 'bifrost';
export const BIFROST_PROVIDER_NAME = 'Bifrost';

/**
 * Bifrost attaches the tools of its MCP servers to every chat request unless
 * told otherwise. Vane runs MCP tools itself (as researcher actions), and a
 * tool call it did not send would break the research loop, so chat requests
 * narrow the injected tools to a name that matches nothing.
 */
export const BIFROST_NO_INJECTED_TOOLS = 'vane-no-injected-tools';

const MODELS_TIMEOUT_MS = 10000;

/** Headers for every request to the gateway (models, chat, MCP). */
export const bifrostHeaders = (
  cfg: Pick<BifrostConfig, 'virtualKey'>,
): Record<string, string> =>
  cfg.virtualKey ? { 'x-bf-vk': cfg.virtualKey } : {};

/** Extra headers for /v1/chat/completions and /v1/embeddings. */
export const bifrostChatHeaders = (
  cfg: Pick<BifrostConfig, 'virtualKey'>,
): Record<string, string> => ({
  ...bifrostHeaders(cfg),
  'x-bf-mcp-include-tools': BIFROST_NO_INJECTED_TOOLS,
});

const EMBEDDING_HINT = /embed/i;

/** Splits Bifrost's /v1/models list into chat and embedding models. */
export const parseBifrostModels = (body: any): ModelList => {
  const data: any[] = Array.isArray(body?.data) ? body.data : [];
  const chat: Model[] = [];
  const embedding: Model[] = [];
  const seen = new Set<string>();

  for (const m of data) {
    const key = typeof m?.id === 'string' ? m.id.trim() : '';
    if (!key || seen.has(key)) continue;
    seen.add(key);

    const model = {
      key,
      name: typeof m?.name === 'string' && m.name ? m.name : key,
    };
    (EMBEDDING_HINT.test(key) ? embedding : chat).push(model);
  }

  const byName = (a: Model, b: Model) => a.key.localeCompare(b.key);
  return { chat: chat.sort(byName), embedding: embedding.sort(byName) };
};

export const fetchBifrostModels = async (
  cfg: Pick<BifrostConfig, 'url' | 'virtualKey'>,
): Promise<ModelList> => {
  const res = await fetch(`${cfg.url}/v1/models`, {
    headers: bifrostHeaders(cfg),
    signal: AbortSignal.timeout(MODELS_TIMEOUT_MS),
  });

  if (!res.ok) {
    throw new Error(
      `Bifrost returned ${res.status} for /v1/models: ${(await res.text()).slice(0, 200)}`,
    );
  }

  return parseBifrostModels(await res.json());
};
