import { afterEach, describe, expect, it, vi } from 'vitest';
import z from 'zod';

const bifrost = vi.hoisted(() => ({
  value: {
    enabled: true,
    url: 'http://gw',
    virtualKey: 'vk',
    mcpEnabled: true,
    mcpTools: [] as string[],
  },
}));

vi.mock('@/lib/config/serverRegistry', () => ({
  getBifrostConfig: () => bifrost.value,
}));

import MCPHttpClient, { mcpResultToText, parseSSEMessage } from '../mcp/client';
import { jsonObjectToZod } from '../mcp/jsonSchemaToZod';
import {
  getMCPServers,
  isToolAllowed,
  syncMCPActions,
  toActionName,
  truncateResult,
} from '../agents/search/researcher/actions/mcp';
import ActionRegistry from '../agents/search/researcher/actions/registry';

afterEach(() => vi.unstubAllGlobals());

/** Fake Streamable HTTP server: replies by method. */
const fakeServer = (
  tools: any[],
  callResult: any = { content: [{ type: 'text', text: 'ok' }] },
) =>
  vi.fn(async (_url: string, init: any) => {
    const body = JSON.parse(init.body);
    if (!('id' in body)) return new Response(null, { status: 202 });
    const result =
      body.method === 'initialize'
        ? { protocolVersion: '2025-06-18', capabilities: {} }
        : body.method === 'tools/list'
          ? { tools }
          : callResult;
    return new Response(
      JSON.stringify({ jsonrpc: '2.0', id: body.id, result }),
      {
        headers: { 'content-type': 'application/json', 'mcp-session-id': 's1' },
      },
    );
  });

describe('MCPHttpClient', () => {
  it('initializes once, keeps the session id and lists tools', async () => {
    const fetchMock = fakeServer([{ name: 'brave-search' }]);
    vi.stubGlobal('fetch', fetchMock);
    const client = new MCPHttpClient('http://gw/mcp', { 'x-bf-vk': 'vk' });

    expect(await client.listTools()).toEqual([{ name: 'brave-search' }]);
    await client.callTool('brave-search', { q: 'x' });

    const methods = fetchMock.mock.calls.map(
      (c) => JSON.parse(c[1].body).method,
    );
    expect(methods).toEqual([
      'initialize',
      'notifications/initialized',
      'tools/list',
      'tools/call',
    ]);
    expect(fetchMock.mock.calls[3][1].headers['Mcp-Session-Id']).toBe('s1');
    expect(fetchMock.mock.calls[3][1].headers['x-bf-vk']).toBe('vk');
  });

  it('reads replies sent as SSE', () => {
    const body =
      'event: message\ndata: {"jsonrpc":"2.0","method":"note"}\n\n' +
      'event: message\ndata: {"jsonrpc":"2.0","id":3,"result":{"tools":[]}}\n\n';
    expect(parseSSEMessage(body, 3).result).toEqual({ tools: [] });
  });

  it('surfaces JSON-RPC errors', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              jsonrpc: '2.0',
              id: 1,
              error: { code: -32601, message: 'nope' },
            }),
          ),
      ),
    );
    await expect(
      new MCPHttpClient('http://gw/mcp').listTools(),
    ).rejects.toThrow(/nope/);
  });

  it('flattens tool results to text', () => {
    expect(
      mcpResultToText({
        content: [
          { type: 'text', text: 'a' },
          { type: 'image', data: '...' },
        ],
      }),
    ).toBe('a\n\n[image content omitted]');
    expect(mcpResultToText({ structuredContent: { n: 1 } })).toBe('{"n":1}');
  });
});

describe('jsonObjectToZod', () => {
  it('keeps types, required fields and descriptions', () => {
    const schema = jsonObjectToZod({
      type: 'object',
      properties: {
        query: { type: 'string', description: 'What to search' },
        count: { type: 'integer' },
        tags: { type: 'array', items: { type: 'string' } },
        mode: { enum: ['a', 'b'] },
      },
      required: ['query'],
    });

    expect(schema.parse({ query: 'x' })).toEqual({ query: 'x' });
    expect(() => schema.parse({})).toThrow();
    const json: any = z.toJSONSchema(schema);
    expect(json.required).toEqual(['query']);
    expect(json.properties.query.description).toBe('What to search');
    expect(json.properties.tags.items.type).toBe('string');
  });

  it('accepts a missing schema', () => {
    expect(jsonObjectToZod(undefined).parse({})).toEqual({});
  });
});

describe('MCP actions', () => {
  it('allows read-only tools by default and the allow list otherwise', () => {
    expect(isToolAllowed({ name: 'fs-write', annotations: {} }, [])).toBe(
      false,
    );
    expect(
      isToolAllowed(
        { name: 'fs-read', annotations: { readOnlyHint: true } },
        [],
      ),
    ).toBe(true);
    expect(isToolAllowed({ name: 'brave-web_search' }, ['brave-*'])).toBe(true);
    expect(
      isToolAllowed({ name: 'github-create_issue' }, [
        'brave-*',
        'github-search_code',
      ]),
    ).toBe(false);
  });

  it('builds valid tool names and caps results', () => {
    expect(toActionName('brave.web search')).toBe('mcp_brave_web_search');
    expect(toActionName('x'.repeat(100))).toHaveLength(64);
    expect(truncateResult('abcdef', 3)).toMatch(/^abc\n\n\[truncated: 3/);
  });

  it('uses the Bifrost /mcp endpoint only when both switches are on', () => {
    expect(getMCPServers()[0].url).toBe('http://gw/mcp');
    expect(getMCPServers({ ...bifrost.value, mcpEnabled: false })).toEqual([]);
    expect(getMCPServers({ ...bifrost.value, enabled: false })).toEqual([]);
  });

  it('registers allowed tools as actions that return search results', async () => {
    vi.stubGlobal(
      'fetch',
      fakeServer(
        [
          {
            name: 'docs-lookup',
            description: 'Look up docs',
            inputSchema: {
              type: 'object',
              properties: { q: { type: 'string' } },
            },
            annotations: { readOnlyHint: true },
          },
          { name: 'fs-delete' },
        ],
        { content: [{ type: 'text', text: 'found it' }] },
      ),
    );

    await syncMCPActions();

    expect(ActionRegistry.get('mcp_fs-delete')).toBeUndefined();
    const action = ActionRegistry.get('mcp_docs-lookup')!;
    expect(action.getToolDescription({ mode: 'speed' })).toMatch(
      /Look up docs/,
    );

    const session: any = { getBlock: () => undefined, updateBlock: vi.fn() };
    const out: any = await action.execute({ q: 'x' }, {
      session,
      researchBlockId: 'r',
    } as any);
    expect(out.type).toBe('search_results');
    expect(out.results[0].content).toBe('found it');
    expect(out.results[0].metadata.title).toBe('MCP: docs-lookup');

    bifrost.value = { ...bifrost.value, mcpEnabled: false };
    await syncMCPActions();
    expect(ActionRegistry.get('mcp_docs-lookup')).toBeUndefined();
  });
});
