import ModelRegistry from '@/lib/models/registry';
import { ModelWithProvider } from '@/lib/models/types';
import { BENCHMARK_CASES } from '@/lib/benchmark/cases';
import { runCase, CaseResult } from '@/lib/benchmark/runner';
import { buildReport } from '@/lib/benchmark/report';
import {
  getBifrostConfig,
  getConfiguredModelProviderById,
  getFirecrawlURL,
  getSearchProvider,
  getSearxngURL,
} from '@/lib/config/serverRegistry';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Body = {
  chatModel: ModelWithProvider;
  embeddingModel: ModelWithProvider;
  cases?: string[];
};

/* Runs the fixed benchmark questions with the given models and streams
   NDJSON progress: caseStart, caseEnd, then the full report. Only fixed test
   questions are sent; no chat history or uploaded file is read, and the
   report never contains API keys. */
export const POST = async (req: Request) => {
  let body: Body;
  try {
    body = await req.json();
  } catch {
    return Response.json({ message: 'Invalid JSON' }, { status: 400 });
  }
  if (
    !body.chatModel?.providerId ||
    !body.chatModel?.key ||
    !body.embeddingModel?.providerId ||
    !body.embeddingModel?.key
  ) {
    return Response.json(
      { message: 'chatModel and embeddingModel are required' },
      { status: 400 },
    );
  }

  const cases = BENCHMARK_CASES.filter(
    (c) => !body.cases || body.cases.includes(c.id),
  );
  if (!cases.length)
    return Response.json(
      { message: 'No benchmark case selected' },
      { status: 400 },
    );

  const registry = new ModelRegistry();
  let llm, embedding;
  try {
    [llm, embedding] = await Promise.all([
      registry.loadChatModel(body.chatModel.providerId, body.chatModel.key),
      registry.loadEmbeddingModel(
        body.embeddingModel.providerId,
        body.embeddingModel.key,
      ),
    ]);
  } catch (err: any) {
    return Response.json(
      { message: `Could not load models: ${err?.message ?? err}` },
      { status: 400 },
    );
  }

  const providerType = (id: string) =>
    getConfiguredModelProviderById(id)?.type ?? id;
  const urls = { searxng: getSearxngURL(), firecrawl: getFirecrawlURL() };
  const environment = {
    appVersion: process.env.NEXT_PUBLIC_VERSION ?? '',
    node: process.version,
    startedAt: new Date().toISOString(),
    chatModel: {
      provider: providerType(body.chatModel.providerId),
      key: body.chatModel.key,
    },
    embeddingModel: {
      provider: providerType(body.embeddingModel.providerId),
      key: body.embeddingModel.key,
    },
    searchProvider: getSearchProvider(),
    searxngConfigured: !!urls.searxng,
    firecrawlConfigured: !!urls.firecrawl,
    bifrostEnabled: getBifrostConfig().enabled,
  };

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (obj: unknown) => {
        try {
          controller.enqueue(encoder.encode(JSON.stringify(obj) + '\n'));
        } catch {}
      };
      send({
        type: 'start',
        cases: cases.map((c) => ({ id: c.id, label: c.label })),
      });

      const results: CaseResult[] = [];
      /* One case at a time, so cases don't compete for the model. */
      for (const c of cases) {
        if (req.signal.aborted) break;
        send({ type: 'caseStart', id: c.id });
        const result = await runCase(
          c,
          { llm: llm!, embedding: embedding! },
          urls,
        );
        results.push(result);
        send({
          type: 'caseEnd',
          id: c.id,
          ok: result.ok,
          totalMs: result.timing.totalMs,
        });
      }

      send({ type: 'report', report: buildReport(environment, results) });
      try {
        controller.close();
      } catch {}
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'application/x-ndjson',
      'Cache-Control': 'no-cache',
    },
  });
};
