import { describe, expect, it } from 'vitest';
import { FakeEmbedding, FakeLLM } from '@/__tests__/helpers/fakes';
import { InstrumentedLLM, classifyURL, newRecorder } from '../instrument';
import { analyze } from '../analyze';
import { runProbes } from '../probe';
import { runCase, CaseResult } from '../runner';
import { BENCHMARK_CASES } from '../cases';
import { buildReport, reportToMarkdown } from '../report';
import { runTraced, trace, withTraceLabel } from '@/lib/trace';

const result = (over: Partial<CaseResult>): CaseResult => ({
  id: 'academic',
  label: 'Acadêmica',
  kind: 'search',
  mode: 'balanced',
  query: 'Quais os efeitos do jejum intermitente?',
  expectSkipSearch: false,
  ok: true,
  timing: { totalMs: 10000, researchDoneMs: 4000, firstTokenMs: 5000 },
  answer: 'O jejum tem efeitos.',
  sources: [],
  resultCount: 0,
  llm: [],
  embedding: [],
  http: [],
  events: [],
  ...over,
});
const titles = (r: CaseResult[]) => analyze(r).findings.map((f) => f.title);
const env = {
  appVersion: 't',
  node: 'v',
  startedAt: 'now',
  chatModel: { provider: 'p', key: 'k' },
  embeddingModel: { provider: 'p', key: 'e' },
  searchProvider: 'firecrawl',
  searxngConfigured: true,
  firecrawlConfigured: true,
  bifrostEnabled: false,
};

describe('classificação das chamadas HTTP', () => {
  const c = classifyURL({
    searxng: 'http://host.docker.internal:8080',
    firecrawl: 'http://firecrawl:3002',
    bifrost: 'http://host.docker.internal:8080',
  });
  it('separa busca e leitura no Firecrawl', () => {
    expect(c(new URL('http://firecrawl:3002/v2/search'))).toBe(
      'firecrawl-search',
    );
    expect(c(new URL('http://firecrawl:3002/v2/scrape'))).toBe(
      'firecrawl-scrape',
    );
  });
  it('separa SearXNG e Bifrost no mesmo endereço', () => {
    expect(c(new URL('http://host.docker.internal:8080/mcp'))).toBe('bifrost');
    expect(
      c(new URL('http://host.docker.internal:8080/search?format=json')),
    ).toBe('searxng');
    expect(c(new URL('http://lms:1234/v1/chat/completions'))).toBe('model');
  });
});

describe('rastreio', () => {
  it('não faz nada fora do benchmark', () => {
    expect(() =>
      trace({ type: 'research_iteration', iteration: 0, actions: [] }),
    ).not.toThrow();
    expect(withTraceLabel('x', () => 1)).toBe(1);
  });

  it('o LLM medido repassa a janela de contexto e grava o rótulo', async () => {
    const rec = newRecorder();
    const inner = new FakeLLM({ generateObject: () => ({ a: 1 }) });
    inner.getContextWindow = async () => 8192;
    const llm = new InstrumentedLLM(inner, rec);
    expect(await llm.getContextWindow()).toBe(8192);
    await runTraced(
      () => {},
      () =>
        withTraceLabel('classifier', () =>
          llm.generateObject({ messages: [], schema: {} as any }),
        ),
    );
    expect(rec.llm[0].label).toBe('classifier');
  });

  it('caso de cálculo rotula classificação e redator', async () => {
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
        { contentChunk: '351.', toolCallChunk: [], done: true },
      ],
    });
    const c = BENCHMARK_CASES.find((x) => x.id === 'calculation')!;
    const r = await runCase(c, { llm, embedding: new FakeEmbedding() }, {});
    expect(r.llm.map((x) => x.label)).toEqual(['classifier', 'writer']);
  });
});

describe('diagnóstico de busca sem fontes', () => {
  it('classificador pulou a busca', () => {
    expect(titles([result({})])).toContain('O classificador pulou a busca');
  });

  it('filtro descartou tudo, com Firecrawl como busca', () => {
    const r = result({
      http: Array.from({ length: 6 }, (_, i) => ({
        target: 'firecrawl-search' as const,
        host: 'fc',
        startMs: i * 1000,
        ms: 900,
        status: 200,
      })),
      events: [
        { type: 'research_iteration', iteration: 0, actions: ['web_search'] },
        {
          type: 'search_query',
          mode: 'balanced',
          results: 10,
          kept: 0,
          fallback: false,
          simMedian: 0.31,
        },
        {
          type: 'search_merge',
          mode: 'balanced',
          scored: 0,
          unique: 0,
          returned: 0,
        },
        { type: 'writer_sources', found: 0, kept: 0, contextChars: 0 },
      ],
      answer: 'O jejum reduz a glicose [1][2].',
    });
    const f = analyze([r]).findings;
    const t = f.map((x) => x.title);
    expect(t).toContain('Resultados descartados antes do redator');
    expect(t).toContain('Citou fontes sem ter nenhuma');
    expect(t).not.toContain('Nenhum bug encontrado');
    expect(
      f.find((x) => x.title === 'Resultados descartados antes do redator')!
        .detail,
    ).toMatch(/similaridade mediana 0.31/);
    expect(analyze([r]).rows[0].searchRequests).toBe(6);
    expect(analyze([r]).rows[0].pageRequests).toBe(0);
  });

  it('fontes cortadas pelo contexto', () => {
    const r = result({
      events: [
        { type: 'research_iteration', iteration: 0, actions: ['web_search'] },
        {
          type: 'search_query',
          mode: 'speed',
          results: 10,
          kept: 5,
          fallback: false,
        },
        { type: 'writer_sources', found: 5, kept: 0, contextChars: 0 },
      ],
    });
    expect(titles([r])).toContain('Fontes cortadas para caber no contexto');
  });

  it('busca sem resultados', () => {
    const r = result({
      events: [
        { type: 'research_iteration', iteration: 0, actions: ['web_search'] },
        {
          type: 'search_query',
          mode: 'speed',
          results: 0,
          kept: 0,
          fallback: false,
        },
      ],
    });
    expect(titles([r])).toContain('A busca não trouxe resultados');
  });
});

describe('raciocínio escondido e contexto', () => {
  it('acusa chamada estruturada lenta para pouca saída', () => {
    const r = result({
      sources: [{ title: 'a', url: 'https://a' }],
      resultCount: 1,
      llm: [
        {
          kind: 'generateObject',
          label: 'media:images',
          startMs: 0,
          ms: 29000,
          inputChars: 985,
          outputChars: 40,
        },
        {
          kind: 'generateObject',
          label: 'classifier',
          startMs: 0,
          ms: 1200,
          inputChars: 6000,
          outputChars: 260,
        },
      ],
    });
    const f = analyze([r]).findings.find(
      (x) =>
        x.title === 'O modelo raciocina escondido nas chamadas estruturadas',
    );
    expect(f?.detail).toMatch(/1 de 2/);
    expect(f?.detail).toMatch(/media:images/);
  });

  it('usa a janela real do modelo', () => {
    const r = result({
      sources: [{ title: 'a', url: 'https://a' }],
      resultCount: 1,
      llm: [
        {
          kind: 'streamText',
          startMs: 0,
          ms: 100,
          inputChars: 20000,
          outputChars: 10,
        },
      ],
    });
    const big = analyze([r], { ...env, contextWindow: 32000 }).findings.map(
      (x) => x.title,
    );
    expect(big).not.toContain('Prompt maior que o contexto do modelo');
    const small = analyze([r], { ...env, contextWindow: 4096 }).findings.map(
      (x) => x.title,
    );
    expect(small).toContain('Prompt maior que o contexto do modelo');
    expect(small).toContain('Contexto do modelo pequeno');
  });

  it('relatório mostra funil e tempo por etapa', () => {
    const r = result({
      llm: [
        {
          kind: 'generateObject',
          label: 'classifier',
          startMs: 0,
          ms: 2000,
          inputChars: 1,
          outputChars: 1,
        },
      ],
      events: [
        {
          type: 'search_query',
          mode: 'speed',
          results: 10,
          kept: 3,
          fallback: false,
        },
        { type: 'writer_sources', found: 3, kept: 3, contextChars: 900 },
      ],
    });
    const md = reportToMarkdown(buildReport(env, [r]));
    expect(md).toContain('## Funil da pesquisa');
    expect(md).toContain('## Tempo do modelo por etapa');
    expect(md).toContain('classifier');
  });
});

describe('sondagem da configuração', () => {
  const res = (body: string, type: string, status = 200) =>
    new Response(body, { status, headers: { 'content-type': type } });

  it('acusa HTML no lugar de JSON e endereço compartilhado', async () => {
    const f = await runProbes(
      {
        searxngURL: 'http://host.docker.internal:8080',
        bifrost: { enabled: true, url: 'http://host.docker.internal:8080' },
        needsSearxng: true,
      },
      {
        inContainer: true,
        fetch: async () => res('<!doctype html><html>', 'text/html'),
      },
    );
    const t = f.map((x) => x.title);
    expect(t).toContain('A URL da SearXNG não devolve JSON');
    expect(t).toContain('SearXNG e Bifrost no mesmo endereço');
    expect(t).not.toContain('Bifrost inacessível');
  });

  it('acusa localhost dentro do container e serviço fora do ar', async () => {
    const f = await runProbes(
      {
        searxngURL: 'http://searxng:8080',
        bifrost: { enabled: true, url: 'http://127.0.0.1:8080' },
        needsSearxng: true,
      },
      {
        inContainer: true,
        fetch: async (url) => {
          if (url.includes('127.0.0.1')) throw new TypeError('fetch failed');
          return res('{"results":[]}', 'application/json');
        },
      },
    );
    const t = f.map((x) => x.title);
    expect(t).toContain('Bifrost aponta para o próprio container');
    expect(t).toContain('Bifrost inacessível');
    expect(t).not.toContain('A URL da SearXNG não devolve JSON');
  });

  it('SearXNG sem json em search.formats', async () => {
    const f = await runProbes(
      { searxngURL: 'http://searxng:8080', needsSearxng: true },
      {
        inContainer: false,
        fetch: async () => res('Forbidden', 'text/html', 403),
      },
    );
    expect(f.map((x) => x.title)).toEqual(['SearXNG recusa o formato JSON']);
  });
});
