import http from 'node:http';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { FakeEmbedding, FakeLLM } from '@/__tests__/helpers/fakes';
import { InstrumentedLLM, newRecorder, withHttpTrace } from '../instrument';
import { analyze } from '../analyze';
import { runCase, CaseResult } from '../runner';
import { BENCHMARK_CASES } from '../cases';
import { buildReport, reportToMarkdown } from '../report';

describe('instrumentação', () => {
  let server: http.Server;
  let base = '';
  beforeAll(async () => {
    server = http.createServer((req, res) => {
      res.writeHead(req.url === '/fail' ? 500 : 200);
      res.end('ok');
    });
    await new Promise<void>((r) => server.listen(0, '127.0.0.1', () => r()));
    base = `http://127.0.0.1:${(server.address() as any).port}`;
  });
  afterAll(() => new Promise<void>((r) => server.close(() => r())));

  it('o LLM medido devolve exatamente o que o original devolve', async () => {
    const rec = newRecorder();
    const inner = new FakeLLM({
      generateObject: () => ({ a: 1 }),
      streamText: () => [
        { contentChunk: 'Olá', toolCallChunk: [], done: false },
        { contentChunk: ' mundo', toolCallChunk: [], done: true },
      ],
    });
    const llm = new InstrumentedLLM(inner, rec);
    expect(
      await llm.generateObject({
        messages: [{ role: 'user', content: 'abc' }],
        schema: {} as any,
      }),
    ).toEqual({ a: 1 });
    const chunks: string[] = [];
    for await (const c of llm.streamText({
      messages: [{ role: 'user', content: 'xy' }],
    }))
      chunks.push(c.contentChunk);
    expect(chunks.join('')).toBe('Olá mundo');
    expect(rec.llm.map((c) => [c.kind, c.inputChars, c.outputChars])).toEqual([
      ['generateObject', 3, 7],
      ['streamText', 2, 9],
    ]);
  });

  it('só registra HTTP dentro do benchmark e classifica a SearxNG', async () => {
    const rec = newRecorder();
    await fetch(`${base}/fora`);
    await withHttpTrace(rec, { searxng: base }, async () => {
      await fetch(`${base}/search?q=x`);
      await fetch(`${base}/fail`);
    });
    await fetch(`${base}/fora-de-novo`);
    expect(rec.http.map((h) => [h.target, h.status])).toEqual([
      ['searxng', 200],
      ['searxng', 500],
    ]);
  });
});

const baseResult = (over: Partial<CaseResult>): CaseResult => ({
  id: 'web-speed',
  label: 'Web · speed',
  kind: 'search',
  mode: 'speed',
  query: 'Qual é a capital da Austrália?',
  expectSkipSearch: false,
  ok: true,
  timing: { totalMs: 10000, researchDoneMs: 4000, firstTokenMs: 5000 },
  answer: 'A capital é Camberra[1].',
  sources: [
    { title: 'Canberra', url: 'https://pt.wikipedia.org/wiki/Canberra' },
  ],
  resultCount: 1,
  llm: [],
  embedding: [],
  http: [],
  ...over,
});
const titles = (r: CaseResult[]) => analyze(r).findings.map((f) => f.title);

describe('análise', () => {
  it('resultado limpo não gera bug', () => {
    expect(titles([baseResult({})])).toEqual(['Nenhum bug encontrado']);
  });

  it('acusa citação quebrada, idioma e título', () => {
    const t = titles([
      baseResult({
        answer: '# Capital\n\nThe capital is Canberra and it is nice[3].',
      }),
    ]);
    expect(t).toContain('Citação para fonte inexistente');
    expect(t).toContain('Resposta em outro idioma');
    expect(t).toContain('Resposta com título principal');
  });

  it('acusa embeddings um a um, SearxNG com erro e contexto pequeno', () => {
    const t = titles([
      baseResult({
        embedding: Array.from({ length: 12 }, (_, i) => ({
          startMs: i * 100,
          ms: 80,
          texts: 1,
          chars: 50,
        })),
        http: [
          { target: 'searxng', host: 'x', startMs: 0, ms: 100, status: 502 },
        ],
        llm: [
          {
            kind: 'streamText',
            startMs: 0,
            ms: 9000,
            firstChunkMs: 100,
            inputChars: 20000,
            outputChars: 300,
          },
        ],
      }),
    ]);
    expect(t).toEqual(
      expect.arrayContaining([
        'SearxNG respondeu com erro',
        'Embeddings calculados um texto por vez',
        'Prompt maior que um contexto de 4096 tokens',
        'O modelo de chat domina o tempo',
        'Geração da resposta lenta',
      ]),
    );
  });

  it('acusa busca quando devia pular e site: ignorado', () => {
    const t = titles([
      baseResult({
        id: 'calculation',
        expectSkipSearch: true,
        query: 'Quanto é 15% de 2.340?',
      }),
      baseResult({
        id: 'site-filter',
        query: 'site:wikipedia.org Santos Dumont',
        sources: [{ title: 'x', url: 'https://example.com/a' }],
      }),
    ]);
    expect(t).toContain('Buscou quando não precisava');
    expect(t).toContain('Restrição site: não respeitada');
  });
});

describe('execução de um caso', () => {
  it('cálculo: pula a busca e mede as chamadas', async () => {
    const llm = new FakeLLM({
      generateObject: () => ({
        classification: {
          skipSearch: true,
          personalSearch: false,
          academicSearch: false,
          discussionSearch: false,
          showWeatherWidget: false,
          showStockWidget: false,
          showCalculationWidget: false,
        },
        standaloneFollowUp: 'Quanto é 15% de 2.340?',
      }),
      streamText: () => [
        { contentChunk: '15% de 2.340 é 351.', toolCallChunk: [], done: true },
      ],
    });
    const c = BENCHMARK_CASES.find((x) => x.id === 'calculation')!;
    const r = await runCase(c, { llm, embedding: new FakeEmbedding() }, {});
    expect(r.ok).toBe(true);
    expect(r.answer).toBe('15% de 2.340 é 351.');
    expect(r.sources).toEqual([]);
    expect(r.llm.map((x) => x.kind)).toEqual(['generateObject', 'streamText']);
    expect(r.timing.firstTokenMs).not.toBeNull();

    const report = buildReport(
      {
        appVersion: 't',
        node: 'v',
        startedAt: 'now',
        chatModel: { provider: 'p', key: 'k' },
        embeddingModel: { provider: 'p', key: 'e' },
        searchProvider: 'searxng',
        searxngConfigured: true,
        firecrawlConfigured: false,
        bifrostEnabled: false,
      },
      [r],
    );
    const md = reportToMarkdown(report);
    expect(md).toContain('Cálculo (sem busca)');
    expect(md).not.toMatch(/apiKey|api_key/i);
  });

  it('erro do modelo vira caso com falha, sem derrubar o benchmark', async () => {
    const llm = new FakeLLM({});
    const r = await runCase(
      BENCHMARK_CASES[0],
      { llm, embedding: new FakeEmbedding() },
      {},
    );
    expect(r.ok).toBe(false);
    expect(titles([r])[0]).toMatch(/^Falhou/);
  });
});

describe('ambiente', () => {
  it('acusa SearxNG sem URL', () => {
    const f = analyze([baseResult({})], {
      searchProvider: 'searxng',
      searxngConfigured: false,
    }).findings;
    expect(f[0].title).toBe('SearxNG não configurada');
  });
});
