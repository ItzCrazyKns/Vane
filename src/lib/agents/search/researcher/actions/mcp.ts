import { ResearchAction } from '../../types';
import ActionRegistry from './registry';
import MCPHttpClient, { MCPTool, mcpResultToText } from '@/lib/mcp/client';
import { jsonObjectToZod } from '@/lib/mcp/jsonSchemaToZod';
import { BifrostConfig, getBifrostConfig } from '@/lib/config/serverRegistry';
import { bifrostHeaders } from '@/lib/bifrost';

/**
 * MCP tools become researcher actions named mcp_<tool>. Today the only MCP
 * server is the Bifrost gateway (its /mcp endpoint aggregates every MCP
 * server connected to Bifrost); a generic MCP client can add servers to
 * getMCPServers() without touching the rest.
 *
 * Tools are gated by the settings switch, not by the classifier, which
 * doesn't know about them.
 */

export const MCP_ACTION_PREFIX = 'mcp_';
/** Cap on text returned to the model per call, to protect the context. */
export const MCP_RESULT_MAX_CHARS = 8000;
const LIST_CACHE_MS = 60_000;
const CALL_TIMEOUT_MS = 30_000;

type MCPServer = {
  id: string;
  url: string;
  headers: Record<string, string>;
  allow: string[];
};

export const getMCPServers = (
  bifrost: BifrostConfig = getBifrostConfig(),
): MCPServer[] =>
  bifrost.enabled && bifrost.mcpEnabled
    ? [
        {
          id: 'bifrost',
          url: `${bifrost.url}/mcp`,
          headers: bifrostHeaders(bifrost),
          allow: bifrost.mcpTools,
        },
      ]
    : [];

const globToRegExp = (pattern: string) =>
  new RegExp(
    `^${pattern
      .split('*')
      .map((p) => p.replace(/[.+?^${}()|[\]\\]/g, '\\$&'))
      .join('.*')}$`,
    'i',
  );

/**
 * With an allow list, only matching tools are exposed. Without one, only
 * tools the server marks read-only, so nothing that writes runs by default.
 */
export const isToolAllowed = (tool: MCPTool, allow: string[]) =>
  allow.length > 0
    ? allow.some((p) => globToRegExp(p).test(tool.name))
    : tool.annotations?.readOnlyHint === true;

/** OpenAI-style tool names: [a-zA-Z0-9_-], at most 64 characters. */
export const toActionName = (toolName: string) =>
  `${MCP_ACTION_PREFIX}${toolName.replace(/[^a-zA-Z0-9_-]/g, '_')}`.slice(
    0,
    64,
  );

export const truncateResult = (text: string, max = MCP_RESULT_MAX_CHARS) =>
  text.length > max
    ? `${text.slice(0, max)}\n\n[truncated: ${text.length - max} more characters]`
    : text;

const createMCPAction = (
  server: MCPServer,
  client: MCPHttpClient,
  tool: MCPTool,
): ResearchAction => {
  const name = toActionName(tool.name);
  const description = `${tool.description || `MCP tool ${tool.name}`} (external tool from the ${server.id} MCP server; call it when it can answer part of the question better than a web search).`;

  return {
    name,
    schema: jsonObjectToZod(tool.inputSchema),
    getToolDescription: () => description,
    getDescription: () => description,
    enabled: () => true,
    execute: async (params, additionalConfig) => {
      const block = additionalConfig.session.getBlock(
        additionalConfig.researchBlockId,
      );
      if (block && block.type === 'research') {
        block.data.subSteps.push({
          id: crypto.randomUUID(),
          type: 'reasoning',
          reasoning: `MCP: ${tool.name}`,
        });
        additionalConfig.session.updateBlock(additionalConfig.researchBlockId, [
          { op: 'replace', path: '/data/subSteps', value: block.data.subSteps },
        ]);
      }

      let content: string;
      try {
        const result = await client.callTool(tool.name, params ?? {});
        const text = mcpResultToText(result) || '(empty result)';
        content = truncateResult(
          result.isError ? `The tool reported an error: ${text}` : text,
        );
      } catch (err: any) {
        /* A failed tool must not abort the whole research loop. */
        console.error(`MCP tool ${tool.name} failed:`, err);
        content = `The tool call failed: ${err?.message ?? String(err)}`;
      }

      return {
        type: 'search_results',
        results: [
          {
            content,
            metadata: {
              title: `MCP: ${tool.name}`,
              url: `mcp://${server.id}/${encodeURIComponent(tool.name)}?call=${crypto.randomUUID()}`,
            },
          },
        ],
      };
    },
  };
};

let cache: { key: string; at: number; actions: ResearchAction[] } | undefined;

/**
 * Brings the registered mcp_* actions in line with the current settings.
 * Called at the start of each research run; the tool list is cached for a
 * minute. Errors are logged and leave the researcher without MCP tools.
 */
export const syncMCPActions = async (): Promise<void> => {
  const servers = getMCPServers();
  const key = JSON.stringify(servers);

  try {
    if (!cache || cache.key !== key || Date.now() - cache.at > LIST_CACHE_MS) {
      const actions: ResearchAction[] = [];
      for (const server of servers) {
        const client = new MCPHttpClient(
          server.url,
          server.headers,
          CALL_TIMEOUT_MS,
        );
        const tools = await client.listTools();
        tools
          .filter((t) => isToolAllowed(t, server.allow))
          .forEach((t) => actions.push(createMCPAction(server, client, t)));
      }
      cache = { key, at: Date.now(), actions };
    }
  } catch (err) {
    console.error('Failed to load MCP tools:', err);
    cache = { key, at: Date.now(), actions: [] };
  }

  ActionRegistry.unregisterWhere((name) => name.startsWith(MCP_ACTION_PREFIX));
  cache.actions.forEach((a) => ActionRegistry.register(a));
};
