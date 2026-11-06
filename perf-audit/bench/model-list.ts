/**
 * Bench: model-list GETs and added latency per /api/chat request.
 *
 * /api/chat builds a fresh ModelRegistry and loads one chat model and one
 * embedding model before opening its stream. This script reproduces exactly
 * that against a fake LM Studio + Ollama server that answers the model list
 * after a fixed delay (200 ms), and counts the GETs it receives.
 *
 *   npx tsx perf-audit/bench/model-list.ts [requests=10] [runs=5] [delayMs=200]
 *
 * It writes a throwaway config.json under a temp DATA_DIR; nothing in data/
 * is touched.
 */
import fs from 'fs';
import http from 'http';
import os from 'os';
import path from 'path';
import type { AddressInfo } from 'net';

const REQUESTS = Number(process.argv[2] ?? 10);
const RUNS = Number(process.argv[3] ?? 5);
const DELAY_MS = Number(process.argv[4] ?? 200);

let modelListGets = 0;

const server = http.createServer((req, res) => {
  const url = req.url ?? '';
  const isList = url.endsWith('/v1/models') || url.endsWith('/api/tags');
  if (isList) modelListGets++;

  setTimeout(() => {
    res.setHeader('Content-Type', 'application/json');
    if (url.endsWith('/api/tags')) {
      res.end(JSON.stringify({ models: [{ name: 'm', model: 'm' }] }));
    } else if (url.endsWith('/v1/models')) {
      res.end(JSON.stringify({ data: [{ id: 'm' }, { id: 'e' }] }));
    } else {
      res.statusCode = 404;
      res.end('{}');
    }
  }, DELAY_MS);
});

const stats = (xs: number[]) => {
  const mean = xs.reduce((a, b) => a + b, 0) / xs.length;
  const sd = Math.sqrt(
    xs.reduce((a, b) => a + (b - mean) ** 2, 0) / Math.max(1, xs.length - 1),
  );
  return { mean, sd, min: Math.min(...xs), max: Math.max(...xs) };
};

const main = async () => {
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  const port = (server.address() as AddressInfo).port;
  const base = `http://127.0.0.1:${port}`;

  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vane-bench-'));
  fs.mkdirSync(path.join(dataDir, 'data'));
  fs.writeFileSync(
    path.join(dataDir, 'data', 'config.json'),
    JSON.stringify({
      version: 1,
      setupComplete: true,
      preferences: {},
      personalization: {},
      search: { provider: 'searxng', searxngURL: '', firecrawlURL: '' },
      bifrost: {},
      modelProviders: [
        {
          id: 'lms',
          name: 'LM Studio',
          type: 'lmstudio',
          chatModels: [],
          embeddingModels: [],
          config: { baseURL: base },
          hash: 'lms',
        },
        {
          id: 'oll',
          name: 'Ollama',
          type: 'ollama',
          chatModels: [],
          embeddingModels: [],
          config: { baseURL: base },
          hash: 'oll',
        },
      ],
    }),
  );
  process.env.DATA_DIR = dataDir;

  const { default: ModelRegistry } =
    await import('../../src/lib/models/registry');

  const scenarios: [string, string][] = [
    ['lms', 'lms'],
    ['oll', 'oll'],
  ];

  for (const [chatProvider, embProvider] of scenarios) {
    const perRequestMs: number[] = [];
    const getsPerRun: number[] = [];

    for (let run = 0; run < RUNS; run++) {
      modelListGets = 0;
      for (let i = 0; i < REQUESTS; i++) {
        const t0 = performance.now();
        /* Same three steps as POST /api/chat before it opens its stream. */
        const registry = new ModelRegistry();
        await Promise.all([
          registry.loadChatModel(
            chatProvider,
            chatProvider === 'oll' ? 'm' : 'm',
          ),
          registry.loadEmbeddingModel(
            embProvider,
            chatProvider === 'oll' ? 'm' : 'e',
          ),
        ]);
        perRequestMs.push(performance.now() - t0);
      }
      getsPerRun.push(modelListGets);
    }

    const ms = stats(perRequestMs);
    const gets = stats(getsPerRun.map((g) => g / REQUESTS));
    console.log(
      `${chatProvider}: ${RUNS} runs x ${REQUESTS} requests, server delay ${DELAY_MS} ms\n` +
        `  model-list GETs per request: mean ${gets.mean.toFixed(2)} (sd ${gets.sd.toFixed(2)}, min ${gets.min.toFixed(2)}, max ${gets.max.toFixed(2)})\n` +
        `  added latency per request:   mean ${ms.mean.toFixed(1)} ms (sd ${ms.sd.toFixed(1)}, min ${ms.min.toFixed(1)}, max ${ms.max.toFixed(1)})`,
    );
  }

  server.close();
  fs.rmSync(dataDir, { recursive: true, force: true });
};

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
