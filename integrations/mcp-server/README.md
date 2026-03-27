# Perplexica MCP Server

Use [Perplexica](https://github.com/ItzCrazyKns/Perplexica) as a tool in any [MCP](https://modelcontextprotocol.io)-compatible AI client — Claude Desktop, LibreChat, Continue, and more.

## What This Does

Exposes Perplexica's web search as an MCP tool (`perplexica_search`) over SSE transport. AI agents can call this tool to get cited, synthesised answers from web sources.

## Quick Start

### Docker

```bash
cd integrations/mcp-server
docker build -t perplexica-mcp .
docker run -p 8940:8940 \
  -e PERPLEXICA_URL=http://host.docker.internal:3000 \
  -e PERPLEXICA_CHAT_PROVIDER=your-provider-uuid \
  -e PERPLEXICA_CHAT_MODEL=gpt-4o-mini \
  -e PERPLEXICA_EMBED_PROVIDER=your-embed-provider-uuid \
  -e PERPLEXICA_EMBED_MODEL=text-embedding-3-large \
  perplexica-mcp
```

### Manual

```bash
cd integrations/mcp-server
npm install
cp .env.example .env  # edit with your settings
npm run dev
```

### Finding Your Provider IDs

The MCP server needs provider UUIDs from your Perplexica instance:

```bash
curl http://localhost:3000/api/providers
```

Use the `id` field from the response as `PERPLEXICA_CHAT_PROVIDER` / `PERPLEXICA_EMBED_PROVIDER`, and the model `key` as `PERPLEXICA_CHAT_MODEL` / `PERPLEXICA_EMBED_MODEL`.

## Client Configuration

### LibreChat (librechat.yaml)

```yaml
mcpServers:
  perplexica:
    type: sse
    url: http://perplexica-mcp:8940/sse
```

### Claude Desktop (claude_desktop_config.json)

```json
{
  "mcpServers": {
    "perplexica": {
      "url": "http://localhost:8940/sse"
    }
  }
}
```

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `PORT` | No | `8940` | Server port |
| `PERPLEXICA_URL` | No | `http://localhost:3000` | Perplexica backend URL |
| `PERPLEXICA_CHAT_PROVIDER` | Yes | — | Chat model provider UUID (from `/api/providers`) |
| `PERPLEXICA_CHAT_MODEL` | Yes | — | Chat model key |
| `PERPLEXICA_EMBED_PROVIDER` | Yes | — | Embedding provider UUID (from `/api/providers`) |
| `PERPLEXICA_EMBED_MODEL` | Yes | — | Embedding model key |

## Tool Reference

### `perplexica_search`

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `query` | string | Yes | Search query |
| `sources` | string[] | No | Sources to search. Default: `["web"]`. Options: `"web"`, `"academic"`, `"discussions"` |

Returns the synthesised answer text with source citations.

## How It Works

1. MCP client connects via SSE to `/sse`
2. Client calls the `perplexica_search` tool with a query
3. Server forwards the query to Perplexica's `POST /api/search` endpoint
4. Server returns the synthesised answer with source citations to the MCP client

## Important Notes

- **No `express.json()` middleware** — the MCP SDK reads the raw request stream internally. Adding body-parsing middleware breaks the SSE transport handshake.
- Uses the documented `/api/search` endpoint with `sources: ["web"]` (v1.12.1+ API).
- Source citations are appended as markdown links to the response text.
