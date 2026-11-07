import { analyze } from './analyze';
import type { CaseBreakdown, Finding } from './analyze';
import type { CaseResult } from './runner';

export type BenchmarkEnvironment = {
  appVersion: string;
  node: string;
  startedAt: string;
  chatModel: { provider: string; key: string };
  embeddingModel: { provider: string; key: string };
  searchProvider: string;
  searxngConfigured: boolean;
  firecrawlConfigured: boolean;
  bifrostEnabled: boolean;
  /** Context window the chat model reports, when the provider can tell. */
  contextWindow?: number | null;
  inContainer?: boolean;
};

export type BenchmarkReport = {
  environment: BenchmarkEnvironment;
  rows: CaseBreakdown[];
  findings: Finding[];
  results: CaseResult[];
};

export const buildReport = (
  environment: BenchmarkEnvironment,
  results: CaseResult[],
  probes: Finding[] = [],
): BenchmarkReport => ({
  environment,
  ...analyze(results, environment, probes),
  results,
});

const s = (ms: number | null) =>
  ms === null ? '-' : `${(ms / 1000).toFixed(1)}`;
const LABEL: Record<Finding['severity'], string> = {
  bug: 'Bug',
  gargalo: 'Gargalo',
  aviso: 'Aviso',
  sugestao: 'Sugestão',
};

/* Where search results went in each case that searched. */
const funnelSection = (r: BenchmarkReport) => {
  const rows = r.rows.filter(
    (x) => x.funnel.queries > 0 || x.funnel.writerFound !== null,
  );
  if (!rows.length) return [];
  const v = (x: number | null) => (x === null ? '-' : String(x));
  return [
    '## Funil da pesquisa',
    '',
    '| Teste | Iterações | Consultas | Resultados | Após filtro | Filtro zerou | Ao pesquisador | Ao redator | Similaridade mediana |',
    '| --- | --- | --- | --- | --- | --- | --- | --- | --- |',
    ...rows.map(
      ({ label, funnel: f }) =>
        `| ${label} | ${f.iterations} | ${f.queries} | ${f.rawResults} | ${f.keptResults} | ${f.fallbacks} | ${f.returned} | ${v(f.writerKept)}${f.writerFound !== null && f.writerKept !== f.writerFound ? ` de ${f.writerFound}` : ''} | ${f.simMedian ?? '-'} |`,
    ),
    '',
  ];
};

/* Model time per purpose, so the slow step is named, not guessed. */
const labelSection = (r: BenchmarkReport) => {
  const labels = [
    ...new Set(r.rows.flatMap((x) => Object.keys(x.llmMsByLabel))),
  ];
  if (!labels.length) return [];
  return [
    '## Tempo do modelo por etapa (segundos)',
    '',
    `| Teste | ${labels.join(' | ')} |`,
    `| --- | ${labels.map(() => '---').join(' | ')} |`,
    ...r.rows.map(
      (x) =>
        `| ${x.label} | ${labels.map((l) => (x.llmMsByLabel[l] ? s(x.llmMsByLabel[l]) : '-')).join(' | ')} |`,
    ),
    '',
    'Chamadas em paralelo somam o tempo de cada uma.',
    '',
  ];
};

/* Tokens the server reported, per case. Empty when no provider did. */
const tokenSection = (r: BenchmarkReport) => {
  const rows = r.rows.filter((x) => x.tokens);
  if (!rows.length) return [];
  const t = (x: number) => (x ? x.toLocaleString('pt-BR') : '-');
  return [
    '## Tokens (contagem do servidor)',
    '',
    '| Teste | Prompt | Gerados | Raciocínio | Texto de raciocínio (caracteres) | Redator (tokens/s) |',
    '| --- | --- | --- | --- | --- | --- |',
    ...rows.map(
      (x) =>
        `| ${x.label} | ${t(x.tokens!.prompt)} | ${t(x.tokens!.completion)} | ${t(x.tokens!.reasoning)} | ${t(x.tokens!.reasoningChars)} | ${x.writerTokensPerSec ?? '-'} |`,
    ),
    '',
  ];
};

export const reportToMarkdown = (r: BenchmarkReport) => {
  const e = r.environment;
  const lines = [
    `# Benchmark do Vane`,
    '',
    `- Data: ${e.startedAt}`,
    `- Versão: ${e.appVersion} (Node ${e.node})`,
    `- Modelo de chat: ${e.chatModel.provider} / ${e.chatModel.key}`,
    `- Embeddings: ${e.embeddingModel.provider} / ${e.embeddingModel.key}`,
    `- Busca: ${e.searchProvider}${e.firecrawlConfigured ? ', páginas via Firecrawl' : ', páginas via fetch + Readability'}${e.bifrostEnabled ? ', Bifrost ligado' : ''}`,
    `- Contexto do modelo: ${e.contextWindow ? `${e.contextWindow.toLocaleString('pt-BR')} tokens` : 'desconhecido'}${e.inContainer ? ' · rodando em container' : ''}`,
    '',
    '## Resultados (segundos)',
    '',
    '| Teste | OK | Total | 1º token | Pesquisa | Modelo | Embeddings | Busca | Páginas | Chamadas LLM | Fontes |',
    '| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |',
    ...r.rows.map(
      (x) =>
        `| ${x.label} | ${x.ok ? 'sim' : 'não'} | ${s(x.totalMs)} | ${s(x.firstTokenMs)} | ${s(x.researchDoneMs)} | ${s(x.llmBusyMs)} | ${s(x.embeddingBusyMs)} (${x.embeddingCalls}×) | ${s(x.searchBusyMs)} (${x.searchRequests}×) | ${s(x.pagesBusyMs)} (${x.pageRequests}×) | ${x.llmCalls} | ${x.sources} |`,
    ),
    '',
    'As colunas Modelo, Embeddings, Busca (SearXNG ou Firecrawl) e Páginas mostram o tempo em que havia pelo menos uma chamada daquele tipo em andamento. Como as etapas rodam em paralelo, a soma pode passar do total.',
    '',
    ...funnelSection(r),
    ...labelSection(r),
    ...tokenSection(r),
    '## Achados',
    '',
    ...(r.findings.length
      ? r.findings.flatMap((f) => [
          `### ${LABEL[f.severity]}: ${f.title}${f.cases.length ? ` (${[...new Set(f.cases)].join(', ')})` : ''}`,
          '',
          f.detail,
          '',
        ])
      : ['Nenhum achado.', '']),
  ];
  return lines.join('\n');
};
