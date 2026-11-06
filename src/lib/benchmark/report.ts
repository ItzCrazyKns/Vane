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
): BenchmarkReport => ({
  environment,
  ...analyze(results, environment),
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
    '',
    '## Resultados (segundos)',
    '',
    '| Teste | OK | Total | 1º token | Pesquisa | Modelo | Embeddings | SearxNG | Páginas | Chamadas LLM | Fontes |',
    '| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |',
    ...r.rows.map(
      (x) =>
        `| ${x.label} | ${x.ok ? 'sim' : 'não'} | ${s(x.totalMs)} | ${s(x.firstTokenMs)} | ${s(x.researchDoneMs)} | ${s(x.llmBusyMs)} | ${s(x.embeddingBusyMs)} (${x.embeddingCalls}×) | ${s(x.searchBusyMs)} (${x.searchRequests}×) | ${s(x.pagesBusyMs)} (${x.pageRequests}×) | ${x.llmCalls} | ${x.sources} |`,
    ),
    '',
    'As colunas Modelo, Embeddings, SearxNG e Páginas mostram o tempo em que havia pelo menos uma chamada daquele tipo em andamento. Como as etapas rodam em paralelo, a soma pode passar do total.',
    '',
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
