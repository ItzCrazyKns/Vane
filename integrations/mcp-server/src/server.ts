import express, { Request, Response } from "express";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { z } from "zod";

const PORT = parseInt(process.env.PORT ?? "8940");
const PERPLEXICA_URL = process.env.PERPLEXICA_URL ?? "http://localhost:3000";
const PERPLEXICA_CHAT_PROVIDER = process.env.PERPLEXICA_CHAT_PROVIDER ?? "";
const PERPLEXICA_CHAT_MODEL = process.env.PERPLEXICA_CHAT_MODEL ?? "";
const PERPLEXICA_EMBED_PROVIDER = process.env.PERPLEXICA_EMBED_PROVIDER ?? "";
const PERPLEXICA_EMBED_MODEL = process.env.PERPLEXICA_EMBED_MODEL ?? "";

interface SearchResponse {
  message: string;
  sources: Array<{
    content: string;
    metadata: { title: string; url: string };
  }>;
}

async function perplexicaSearch(
  query: string,
  sources: string[] = ["web"],
): Promise<string> {
  const body = {
    chatModel: {
      providerId: PERPLEXICA_CHAT_PROVIDER,
      key: PERPLEXICA_CHAT_MODEL,
    },
    embeddingModel: {
      providerId: PERPLEXICA_EMBED_PROVIDER,
      key: PERPLEXICA_EMBED_MODEL,
    },
    sources,
    query,
    optimizationMode: "speed",
    history: [],
    stream: false,
  };

  const resp = await fetch(`${PERPLEXICA_URL}/api/search`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!resp.ok) {
    throw new Error(`Perplexica ${resp.status}: ${await resp.text()}`);
  }

  const data = (await resp.json()) as SearchResponse;

  // Append source citations if available
  let result = data.message || "";
  if (data.sources?.length) {
    result += "\n\nSources:\n";
    for (const src of data.sources) {
      result += `- [${src.metadata.title}](${src.metadata.url})\n`;
    }
  }

  return result.trim() || "No response from Perplexica";
}

function buildMcpServer(): McpServer {
  const server = new McpServer({
    name: "perplexica",
    version: "1.0.0",
  });

  server.tool(
    "perplexica_search",
    "Search the web using Perplexica AI. Returns cited, synthesised answers from web sources.",
    {
      query: z.string().describe("The search query"),
      sources: z
        .array(z.string())
        .optional()
        .describe(
          'Sources to search. Defaults to ["web"]. Options: "web", "academic", "discussions"',
        ),
    },
    async ({ query, sources }) => {
      try {
        const result = await perplexicaSearch(query, sources ?? ["web"]);
        return { content: [{ type: "text" as const, text: result }] };
      } catch (e) {
        return {
          content: [{ type: "text" as const, text: `Search error: ${e}` }],
        };
      }
    },
  );

  return server;
}

// Do NOT add express.json() or any body-parsing middleware.
// SSEServerTransport.handlePostMessage() reads the raw request body as a
// readable stream. Body-parsing middleware pre-consumes the stream, causing
// MCP handshake to fail with HTTP 400.
const app = express();
const transports: Map<string, SSEServerTransport> = new Map();

app.get("/health", (_req: Request, res: Response) => {
  res.json({ status: "ok", perplexica_url: PERPLEXICA_URL });
});

app.get("/sse", async (_req: Request, res: Response) => {
  const transport = new SSEServerTransport("/messages", res);
  const id = transport.sessionId;
  transports.set(id, transport);
  const server = buildMcpServer();
  await server.connect(transport);
  res.on("close", () => transports.delete(id));
});

app.post("/messages", async (req: Request, res: Response) => {
  const id = req.query.sessionId as string;
  const transport = transports.get(id);
  if (!transport) {
    res.status(404).json({ error: "Session not found" });
    return;
  }
  await transport.handlePostMessage(req, res);
});

app.listen(PORT, () => {
  console.log(`Perplexica MCP server listening on port ${PORT}`);
  console.log(`Perplexica backend: ${PERPLEXICA_URL}`);
});
