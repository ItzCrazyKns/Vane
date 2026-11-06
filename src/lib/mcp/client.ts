/**
 * Minimal MCP client for the Streamable HTTP transport (JSON-RPC 2.0 over
 * POST). It covers what Vane needs from a tool server: initialize,
 * tools/list and tools/call. Responses may come back as plain JSON or as a
 * one-shot SSE stream; both are handled.
 */

export type MCPTool = {
  name: string;
  description?: string;
  inputSchema?: Record<string, any>;
  annotations?: { readOnlyHint?: boolean; [key: string]: any };
};

export type MCPToolResult = {
  content?: { type: string; text?: string; [key: string]: any }[];
  structuredContent?: unknown;
  isError?: boolean;
};

const PROTOCOL_VERSION = '2025-06-18';

export class MCPError extends Error {}

/** Picks the JSON-RPC message with the given id out of an SSE body. */
export const parseSSEMessage = (body: string, id: number): any => {
  const events = body.split(/\r?\n\r?\n/);
  for (const event of events) {
    const data = event
      .split(/\r?\n/)
      .filter((l) => l.startsWith('data:'))
      .map((l) => l.slice(5).trimStart())
      .join('\n');
    if (!data) continue;
    try {
      const msg = JSON.parse(data);
      if (msg?.id === id) return msg;
    } catch {
      /* keep-alive or partial event */
    }
  }
  throw new MCPError('MCP server sent no response for the request');
};

class MCPHttpClient {
  private nextId = 1;
  private sessionId: string | undefined;
  private initialized: Promise<void> | undefined;

  constructor(
    private url: string,
    private headers: Record<string, string> = {},
    private timeoutMs = 20000,
  ) {}

  private async post(body: any, expectReply: boolean): Promise<any> {
    const res = await fetch(this.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json, text/event-stream',
        'MCP-Protocol-Version': PROTOCOL_VERSION,
        ...(this.sessionId && { 'Mcp-Session-Id': this.sessionId }),
        ...this.headers,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(this.timeoutMs),
    });

    const session = res.headers.get('mcp-session-id');
    if (session) this.sessionId = session;

    if (!res.ok) {
      throw new MCPError(
        `MCP server returned ${res.status}: ${(await res.text()).slice(0, 200)}`,
      );
    }
    if (!expectReply) return undefined;

    const type = res.headers.get('content-type') ?? '';
    const msg = type.includes('text/event-stream')
      ? parseSSEMessage(await res.text(), body.id)
      : await res.json();

    if (msg?.error) {
      throw new MCPError(
        `MCP error ${msg.error.code ?? ''}: ${msg.error.message ?? 'unknown'}`.trim(),
      );
    }
    return msg?.result;
  }

  private request(method: string, params?: any) {
    return this.post(
      { jsonrpc: '2.0', id: this.nextId++, method, ...(params && { params }) },
      true,
    );
  }

  private ensureInitialized() {
    this.initialized ??= (async () => {
      await this.request('initialize', {
        protocolVersion: PROTOCOL_VERSION,
        capabilities: {},
        clientInfo: { name: 'vane', version: '1.0.0' },
      });
      await this.post(
        { jsonrpc: '2.0', method: 'notifications/initialized' },
        false,
      );
    })().catch((err) => {
      this.initialized = undefined;
      throw err;
    });
    return this.initialized;
  }

  async listTools(): Promise<MCPTool[]> {
    await this.ensureInitialized();
    const tools: MCPTool[] = [];
    let cursor: string | undefined;
    /* Bounded so a misbehaving server can't page forever. */
    for (let page = 0; page < 20; page++) {
      const result = await this.request(
        'tools/list',
        cursor ? { cursor } : undefined,
      );
      tools.push(...(result?.tools ?? []));
      cursor = result?.nextCursor;
      if (!cursor) break;
    }
    return tools;
  }

  async callTool(
    name: string,
    args: Record<string, any>,
  ): Promise<MCPToolResult> {
    await this.ensureInitialized();
    return (await this.request('tools/call', { name, arguments: args })) ?? {};
  }
}

/** Flattens a tools/call result into text for the model. */
export const mcpResultToText = (result: MCPToolResult): string => {
  const parts = (result.content ?? []).map((c) => {
    if (c.type === 'text' && typeof c.text === 'string') return c.text;
    if (c.type === 'resource' && typeof c.resource?.text === 'string')
      return c.resource.text;
    return `[${c.type} content omitted]`;
  });
  if (parts.length === 0 && result.structuredContent !== undefined) {
    parts.push(JSON.stringify(result.structuredContent));
  }
  return parts.join('\n\n');
};

export default MCPHttpClient;
