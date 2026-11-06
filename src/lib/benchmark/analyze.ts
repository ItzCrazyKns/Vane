/* Turns the measured benchmark results into a per-case breakdown and a list
   of findings (bugs, bottlenecks, suggestions). Rule-based: every finding
   cites the numbers that triggered it. */
import type { CaseResult } from './runner';

export type Severity = 'bug' | 'gargalo' | 'aviso' | 'sugestao';

export type Finding = {
  severity: Severity;
  title: string;
  detail: string;
  cases: string[];
};

export type CaseBreakdown = {
  id: string;
  label: string;
  ok: boolean;
  totalMs: number;
  firstTokenMs: number | null;
  researchDoneMs: number | null;
  /** Wall time during which at least one call of the kind was running. */
  llmBusyMs: number;
  embeddingBusyMs: number;
  searchBusyMs: number;
  pagesBusyMs: number;
  llmCalls: number;
  llmCallsByKind: Record<string, number>;
  embeddingCalls: number;
  embeddedTexts: number;
  searchRequests: number;
  pageRequests: number;
  sources: number;
  answerChars: number;
  maxPromptChars: number;
  writerCharsPerSec: number | null;
  /** Real generation speed, when the server reported token counts. */
  writerTokensPerSec: number | null;
  /** Token totals the server reported for this case (null: none did). */
  tokens: TokenTotals | null;
  /** Model time per purpose (classifier, researcher, writer, widget...). */
  llmMsByLabel: Record<string, number>;
  funnel: Funnel;
};

export type TokenTotals = {
  prompt: number;
  completion: number;
  /** Reasoning tokens, when the server counts them. */
  reasoning: number;
  /** Characters of reasoning text the server sent (LM Studio, Ollama). */
  reasoningChars: number;
};

const hasUsage = (c: CaseResult['llm'][number]) =>
  !!c.usage &&
  Object.values(c.usage).some((v) => typeof v === 'number' && v > 0);

export const tokenTotals = (calls: CaseResult['llm']): TokenTotals | null => {
  const withUsage = calls.filter(hasUsage);
  if (!withUsage.length) return null;
  const sum = (
    f: (u: NonNullable<(typeof calls)[number]['usage']>) => number | undefined,
  ) => withUsage.reduce((t, c) => t + (f(c.usage!) ?? 0), 0);
  return {
    prompt: sum((u) => u.promptTokens),
    completion: sum((u) => u.completionTokens),
    reasoning: sum((u) => u.reasoningTokens),
    reasoningChars: sum((u) => u.reasoningChars),
  };
};

/** Where search results went, from the trace events. */
export type Funnel = {
  iterations: number;
  queries: number;
  /** Results the engine returned, summed over queries. */
  rawResults: number;
  /** Kept by the similarity filter. */
  keptResults: number;
  /** Queries where the filter dropped everything and the best were kept. */
  fallbacks: number;
  emptyQueries: number;
  /** Returned to the researcher after deduplication. */
  returned: number;
  writerFound: number | null;
  writerKept: number | null;
  writerContextChars: number | null;
  simMedian: number | null;
};

const union = (spans: { startMs: number; ms: number }[]) => {
  const s = spans
    .map((x) => [x.startMs, x.startMs + x.ms])
    .sort((a, b) => a[0] - b[0]);
  let total = 0;
  let cur: number[] | null = null;
  for (const [a, b] of s) {
    if (!cur || a > cur[1]) {
      if (cur) total += cur[1] - cur[0];
      cur = [a, b];
    } else cur[1] = Math.max(cur[1], b);
  }
  if (cur) total += cur[1] - cur[0];
  return Math.round(total);
};

export const visibleAnswer = (a: string) =>
  a.replace(/<think>[\s\S]*?(<\/think>|$)/g, '').trim();

export const citedNumbers = (text: string): number[] => {
  const out: number[] = [];
  for (const m of text.matchAll(/\[(\d+(?:\s*,\s*\d+)*)\]/g))
    m[1].split(',').forEach((n) => out.push(Number(n.trim())));
  return out;
};

const PT = new Set(
  'que não para uma com são está também pelo pela mais como isso ele ela é ao de do da dos das em no na nos nas foi foram ser tem pode entre sobre qual quais quem'.split(
    ' ',
  ),
);
const EN = new Set(
  'the and is are was were with that this for of which it has have to in on be by from can'.split(
    ' ',
  ),
);

export const guessLanguage = (text: string): 'pt' | 'en' | 'unknown' => {
  let pt = 0;
  let en = 0;
  for (const w of text
    .replace(/site:\S+/g, ' ')
    .toLowerCase()
    .split(/[^\p{L}]+/u)) {
    if (PT.has(w)) pt++;
    if (EN.has(w)) en++;
  }
  return pt === en ? 'unknown' : pt > en ? 'pt' : 'en';
};

const SEARCH_TARGETS = new Set(['searxng', 'firecrawl-search']);
const PAGE_TARGETS = new Set(['firecrawl-scrape', 'firecrawl', 'other']);
const searchHttp = (r: CaseResult) =>
  r.http.filter((h) => SEARCH_TARGETS.has(h.target));
const pageHttp = (r: CaseResult) =>
  r.http.filter((h) => PAGE_TARGETS.has(h.target));

const median = (xs: number[]) => {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
};

export const funnelOf = (r: CaseResult): Funnel => {
  const ev = r.events ?? [];
  const q = ev.flatMap((e) => (e.type === 'search_query' ? [e] : []));
  const merge = ev.flatMap((e) => (e.type === 'search_merge' ? [e] : []));
  const writer = ev.flatMap((e) => (e.type === 'writer_sources' ? [e] : []));
  const w = writer[writer.length - 1];
  return {
    iterations: ev.filter((e) => e.type === 'research_iteration').length,
    queries: q.length,
    rawResults: q.reduce((n, e) => n + e.results, 0),
    keptResults: q.reduce((n, e) => n + e.kept, 0),
    fallbacks: q.filter((e) => e.fallback).length,
    emptyQueries: q.filter((e) => e.results === 0).length,
    returned: merge.length
      ? merge.reduce((n, e) => n + e.returned, 0)
      : q.reduce((n, e) => n + e.kept, 0),
    writerFound: w ? w.found : null,
    writerKept: w ? w.kept : null,
    writerContextChars: w ? w.contextChars : null,
    simMedian: median(
      q.flatMap((e) => (e.simMedian === undefined ? [] : [e.simMedian])),
    ),
  };
};

/* A structured call that takes this long per character of output is
   spending its time on tokens nobody sees: hidden reasoning (Qwen3,
   DeepSeek-R1...) before the JSON. */
const HIDDEN_REASONING_MS_PER_CHAR = 200;
const HIDDEN_REASONING_MIN_MS = 8000;
export const looksLikeHiddenReasoning = (c: {
  kind: string;
  ms: number;
  outputChars: number;
  error?: string;
}) =>
  c.kind === 'generateObject' &&
  !c.error &&
  c.ms >= HIDDEN_REASONING_MIN_MS &&
  c.ms / Math.max(c.outputChars, 1) > HIDDEN_REASONING_MS_PER_CHAR;
const failed = (h: { status: number | null; error?: string }) =>
  !!h.error || (h.status !== null && h.status >= 400);
const sec = (ms: number) => `${(ms / 1000).toFixed(1)} s`;

export const breakdown = (r: CaseResult): CaseBreakdown => {
  const writer = r.llm.filter((c) => c.kind === 'streamText');
  const lastWriter = writer[writer.length - 1];
  const genMs = lastWriter ? lastWriter.ms - (lastWriter.firstChunkMs ?? 0) : 0;
  return {
    id: r.id,
    label: r.label,
    ok: r.ok,
    totalMs: r.timing.totalMs,
    firstTokenMs: r.timing.firstTokenMs,
    researchDoneMs: r.timing.researchDoneMs,
    llmBusyMs: union(r.llm),
    embeddingBusyMs: union(r.embedding),
    searchBusyMs: union(searchHttp(r)),
    pagesBusyMs: union(pageHttp(r)),
    llmCalls: r.llm.length,
    llmCallsByKind: r.llm.reduce<Record<string, number>>(
      (a, c) => ((a[c.kind] = (a[c.kind] ?? 0) + 1), a),
      {},
    ),
    embeddingCalls: r.embedding.length,
    embeddedTexts: r.embedding.reduce((n, e) => n + e.texts, 0),
    searchRequests: searchHttp(r).length,
    pageRequests: pageHttp(r).length,
    sources: r.resultCount,
    answerChars: visibleAnswer(r.answer).length,
    maxPromptChars: Math.max(0, ...r.llm.map((c) => c.inputChars)),
    writerCharsPerSec:
      lastWriter && genMs > 500
        ? Math.round(lastWriter.outputChars / (genMs / 1000))
        : null,
    writerTokensPerSec: (() => {
      const done = lastWriter?.usage?.completionTokens;
      if (!lastWriter || !done) return null;
      const ms = lastWriter.usage?.generationMs ?? genMs;
      return ms > 500 ? Math.round((done / (ms / 1000)) * 10) / 10 : null;
    })(),
    tokens: tokenTotals(r.llm),
    llmMsByLabel: r.llm.reduce<Record<string, number>>(
      (a, c) => (
        (a[c.label ?? c.kind] = (a[c.label ?? c.kind] ?? 0) + c.ms),
        a
      ),
      {},
    ),
    funnel: funnelOf(r),
  };
};

/* When the model doesn't report its window: LM Studio and Ollama often
   default to 4096 tokens. ~3.5 chars per token is a rough average for
   Portuguese/English text. */

const n = (x: number) => x.toLocaleString('pt-BR');

/* Why a search case ended with no sources, from the funnel: the classifier
   skipped search, the search failed or found nothing, the similarity filter
   or dedup dropped everything, or the writer's context had no room. */
const noSourcesFinding = (
  r: CaseResult,
  f: Funnel,
  searches: CaseResult['http'],
): Finding => {
  const failedSearches = searches.filter(failed).length;
  const base = { cases: [r.id] };
  if (f.iterations === 0 && f.queries === 0 && searches.length === 0)
    return {
      ...base,
      severity: 'aviso',
      title: 'O classificador pulou a busca',
      detail:
        'A pergunta precisa de fontes, mas o classificador decidiu responder sem pesquisar (skipSearch). A resposta veio só do conhecimento do modelo.',
    };
  if (f.queries === 0 && searches.length === 0)
    return {
      ...base,
      severity: 'aviso',
      title: 'O pesquisador terminou sem buscar',
      detail: `A pesquisa rodou ${f.iterations} iteração(ões) sem nenhuma consulta de busca.`,
    };
  if (f.rawResults === 0)
    return {
      ...base,
      severity: 'bug',
      title: 'A busca não trouxe resultados',
      detail: `${searches.length || f.queries} consultas${failedSearches ? `, ${failedSearches} com erro` : ''}, nenhum resultado. Confira o serviço de busca.`,
    };
  if (f.writerFound !== null && f.writerFound > 0 && f.writerKept === 0)
    return {
      ...base,
      severity: 'bug',
      title: 'Fontes cortadas para caber no contexto',
      detail: `A pesquisa achou ${f.writerFound} fontes, mas nenhuma coube no contexto do redator. Aumente o contexto do modelo.`,
    };
  return {
    ...base,
    severity: 'bug',
    title: 'Resultados descartados antes do redator',
    detail: `${f.queries} consultas trouxeram ${n(f.rawResults)} resultados; o filtro de similaridade manteve ${n(f.keptResults)}${f.fallbacks ? ` (${f.fallbacks} consulta(s) usaram os melhores porque o filtro zerou)` : ''}${f.simMedian !== null ? `, similaridade mediana ${f.simMedian}` : ''}; ${f.returned} voltaram ao pesquisador e ${f.writerFound ?? 0} chegaram ao redator.`,
  };
};

/* Below this total, percentage-based bottleneck rules are noise. */
const MIN_MS_FOR_SHARE = 3000;

export const analyze = (
  results: CaseResult[],
  env?: {
    searchProvider: string;
    searxngConfigured: boolean;
    contextWindow?: number | null;
  },
  probes: Finding[] = [],
) => {
  const rows = results.map(breakdown);
  const findings: Finding[] = [...probes];
  const add = (f: Finding) => findings.push(f);
  const contextWindow = env?.contextWindow ?? null;
  const contextChars = (contextWindow ?? 4096) * 3.5;

  if (contextWindow !== null && contextWindow < 8192)
    add({
      severity: 'aviso',
      title: 'Contexto do modelo pequeno',
      detail: `O modelo de chat está carregado com ${contextWindow.toLocaleString('pt-BR')} tokens de contexto. Pesquisa e redator cortam fontes e histórico para caber. No LM Studio, aumente o "context length" ao carregar o modelo.`,
      cases: [],
    });

  if (env && env.searchProvider === 'searxng' && !env.searxngConfigured) {
    add({
      severity: 'bug',
      title: 'SearxNG não configurada',
      detail:
        'A busca usa a SearxNG, mas a URL está vazia em Configurações > Busca (ou na variável SEARXNG_API_URL). Toda busca na web falha.',
      cases: [],
    });
  }

  for (const r of results) {
    const b = rows.find((x) => x.id === r.id)!;
    const answer = visibleAnswer(r.answer);

    if (!r.ok) {
      add({
        severity: 'bug',
        title: `Falhou: ${r.label}`,
        detail: (r.error ?? 'erro desconhecido').replace(/\s+/g, ' '),
        cases: [r.id],
      });
      continue;
    }

    const llmErrors = r.llm.filter((c) => c.error);
    if (llmErrors.length)
      add({
        severity: 'bug',
        title: 'Chamadas ao modelo com erro',
        detail: `${llmErrors.length} de ${r.llm.length} chamadas falharam (${llmErrors[0].kind}: ${llmErrors[0].error}). A busca continuou, mas pode ter perdido etapas.`,
        cases: [r.id],
      });
    const embErrors = r.embedding.filter((e) => e.error);
    if (embErrors.length)
      add({
        severity: 'bug',
        title: 'Embeddings com erro',
        detail: `${embErrors.length} chamadas falharam: ${embErrors[0].error}`,
        cases: [r.id],
      });

    const searx = r.http.filter((h) => h.target === 'searxng');
    const searxFail = searx.filter(failed);
    if (searxFail.length)
      add({
        severity: 'bug',
        title: 'SearxNG respondeu com erro',
        detail: `${searxFail.length} de ${searx.length} consultas falharam (${searxFail[0].status ?? searxFail[0].error}). Confira a URL da SearxNG e se o formato JSON está habilitado.`,
        cases: [r.id],
      });

    if (r.kind !== 'search') {
      if (r.resultCount === 0)
        add({
          severity: 'aviso',
          title: `${r.label} sem resultados`,
          detail:
            'A busca não devolveu nada. Verifique se a SearxNG tem motores de imagem/vídeo ativos.',
          cases: [r.id],
        });
      continue;
    }

    if (!answer)
      add({
        severity: 'bug',
        title: 'Resposta vazia',
        detail:
          'O redator terminou sem texto visível (talvez só um bloco <think>).',
        cases: [r.id],
      });

    const cited = citedNumbers(answer);
    const bad = cited.filter((n) => n < 1 || n > r.sources.length);
    if (bad.length && r.sources.length === 0)
      add({
        severity: 'bug',
        title: 'Citou fontes sem ter nenhuma',
        detail: `A resposta cita ${[...new Set(bad)].map((n) => `[${n}]`).join(', ')}, mas nenhuma fonte chegou ao redator. As citações foram inventadas.`,
        cases: [r.id],
      });
    else if (bad.length)
      add({
        severity: 'bug',
        title: 'Citação para fonte inexistente',
        detail: `Citou ${[...new Set(bad)].map((n) => `[${n}]`).join(', ')} com ${r.sources.length} fontes. O link da citação fica quebrado.`,
        cases: [r.id],
      });

    const searchReqs = searchHttp(r);
    const fcFail = searchReqs.filter(
      (h) => h.target === 'firecrawl-search' && failed(h),
    );
    if (fcFail.length)
      add({
        severity: 'bug',
        title: 'Firecrawl (busca) respondeu com erro',
        detail: `${fcFail.length} buscas falharam (${fcFail[0].status ?? fcFail[0].error}).`,
        cases: [r.id],
      });

    if (r.expectSkipSearch && (r.sources.length > 0 || searchReqs.length > 0))
      add({
        severity: 'aviso',
        title: 'Buscou quando não precisava',
        detail: `"${r.query}" deveria ser respondida sem busca (widget/modelo), mas houve ${searchReqs.length} consultas. O classificador gastou tempo à toa.`,
        cases: [r.id],
      });
    if (!r.expectSkipSearch && r.id !== 'weather' && r.sources.length === 0)
      add(noSourcesFinding(r, b.funnel, searchHttp(r)));

    const site = r.query.match(/site:(\S+)/)?.[1];
    if (site && r.sources.length) {
      const off = r.sources.filter((s) => !s.url.includes(site));
      if (off.length)
        add({
          severity: 'aviso',
          title: 'Restrição site: não respeitada',
          detail: `${off.length} de ${r.sources.length} fontes fora de ${site} (ex.: ${off[0].url}).`,
          cases: [r.id],
        });
    }

    const qLang = guessLanguage(r.query);
    const aLang = guessLanguage(answer);
    if (qLang !== 'unknown' && aLang !== 'unknown' && qLang !== aLang)
      add({
        severity: 'aviso',
        title: 'Resposta em outro idioma',
        detail: `Pergunta em ${qLang}, resposta em ${aLang}.`,
        cases: [r.id],
      });

    if (answer.split('\n').some((l) => /^#\s/.test(l)))
      add({
        severity: 'aviso',
        title: 'Resposta com título principal',
        detail:
          'O prompt do redator pede para não usar título "# ". O modelo não seguiu a regra.',
        cases: [r.id],
      });

    const pages = pageHttp(r);
    const pageFail = pages.filter(failed);
    if (pages.length >= 3 && pageFail.length / pages.length > 0.3)
      add({
        severity: 'aviso',
        title: 'Muitas páginas falharam ao abrir',
        detail: `${pageFail.length} de ${pages.length} leituras de página falharam. No modo quality isso tira fontes da resposta.`,
        cases: [r.id],
      });

    if (b.maxPromptChars > contextChars)
      add({
        severity: 'aviso',
        title:
          contextWindow === null
            ? 'Prompt maior que um contexto de 4096 tokens'
            : 'Prompt maior que o contexto do modelo',
        detail: `O maior prompt teve ${b.maxPromptChars.toLocaleString('pt-BR')} caracteres (~${Math.round(b.maxPromptChars / 3.5).toLocaleString('pt-BR')} tokens). Se o modelo no LM Studio/Ollama estiver com o contexto padrão de 4096, o começo do prompt é cortado em silêncio e a qualidade cai. Confira o "context length" do modelo.`,
        cases: [r.id],
      });

    if (b.totalMs >= MIN_MS_FOR_SHARE && b.llmBusyMs / b.totalMs > 0.6)
      add({
        severity: 'gargalo',
        title: 'O modelo de chat domina o tempo',
        detail: `${Math.round((b.llmBusyMs / b.totalMs) * 100)}% de ${sec(b.totalMs)} esperando o modelo (${b.llmCalls} chamadas: ${Object.entries(
          b.llmCallsByKind,
        )
          .map(([k, v]) => `${k} ${v}`)
          .join(', ')}).`,
        cases: [r.id],
      });

    if (b.embeddingCalls >= 10 && b.embeddedTexts / b.embeddingCalls < 2)
      add({
        severity: 'gargalo',
        title: 'Embeddings calculados um texto por vez',
        detail: `${b.embeddingCalls} chamadas para ${b.embeddedTexts} textos, ${sec(b.embeddingBusyMs)} ocupados. Agrupar os textos de cada busca numa chamada só (baseSearch.ts) reduziria isso a poucas chamadas.`,
        cases: [r.id],
      });

    const searches = searchHttp(r);
    if (searches.length && b.searchBusyMs / searches.length > 3000)
      add({
        severity: 'gargalo',
        title: 'Busca lenta',
        detail: `Média de ${sec(b.searchBusyMs / searches.length)} por consulta (${searches.length} consultas). Na SearxNG, desligar motores lentos ou baixar o timeout ajuda.`,
        cases: [r.id],
      });

    if (
      pages.length &&
      b.totalMs >= MIN_MS_FOR_SHARE &&
      b.pagesBusyMs / b.totalMs > 0.3
    )
      add({
        severity: 'gargalo',
        title: 'Leitura de páginas pesa no tempo',
        detail: `${sec(b.pagesBusyMs)} lendo ${pages.length} páginas (${Math.round((b.pagesBusyMs / b.totalMs) * 100)}% do total).`,
        cases: [r.id],
      });

    if (b.writerTokensPerSec !== null && b.writerTokensPerSec < 10)
      add({
        severity: 'gargalo',
        title: 'Geração da resposta lenta',
        detail: `O redator gerou ${b.writerTokensPerSec} tokens/s (contagem do servidor, com o raciocínio incluído). Um modelo menor ou quantizado, ou GPU offload completo no LM Studio, acelera a resposta.`,
        cases: [r.id],
      });
    else if (
      b.writerTokensPerSec === null &&
      b.writerCharsPerSec !== null &&
      b.writerCharsPerSec < 40
    )
      add({
        severity: 'gargalo',
        title: 'Geração da resposta lenta',
        detail: `O redator escreveu ~${b.writerCharsPerSec} caracteres visíveis/s (~${Math.round(b.writerCharsPerSec / 3.5)} tokens/s). A medida conta só o texto da resposta: se o modelo raciocina escondido enquanto escreve, a taxa real de geração é maior e o tempo vai para o raciocínio. Senão, um modelo menor ou quantizado, ou GPU offload completo no LM Studio, acelera a resposta.`,
        cases: [r.id],
      });

    if (r.mode === 'speed' && b.firstTokenMs !== null && b.firstTokenMs > 15000)
      add({
        severity: 'gargalo',
        title: 'Primeira palavra demora no modo speed',
        detail: `${sec(b.firstTokenMs)} até o primeiro token; ${sec(b.researchDoneMs ?? 0)} foram de classificação e pesquisa.`,
        cases: [r.id],
      });
  }

  /* Merge identical titles across cases. */
  const merged = new Map<string, Finding>();
  for (const f of findings) {
    const k = `${f.severity}|${f.title}`;
    const prev = merged.get(k);
    if (prev) {
      prev.cases.push(...f.cases);
      prev.detail += `\n${f.detail}`;
    } else merged.set(k, { ...f, cases: [...f.cases] });
  }

  const ok = rows.filter((r) => r.ok);
  const classifier = results.flatMap((r) => {
    const labelled = r.llm.filter((c) => c.label === 'classifier');
    return labelled.length
      ? labelled
      : r.llm.filter((c) => c.kind === 'generateObject').slice(0, 1);
  });
  if (classifier.length >= 3) {
    const avg = classifier.reduce((n, c) => n + c.ms, 0) / classifier.length;
    if (avg > 3000)
      merged.set('sug-classifier', {
        severity: 'sugestao',
        title: 'Classificação lenta em toda pergunta',
        detail: `A primeira chamada de cada busca (classificação) levou em média ${sec(avg)}. Toda pergunta paga esse tempo antes de buscar. Usar um modelo menor só para essa etapa é uma opção (muda o modelo padrão de uma etapa, então precisa de decisão).`,
        cases: [],
      });
  }
  /* Structured calls (classifier, widgets, media query rewrite) that spend
     far more time than their output needs. */
  /* Measured: the server reported reasoning tokens or reasoning text. */
  const reasoned = results.flatMap((r) =>
    r.llm
      .filter(
        (c) =>
          (c.usage?.reasoningTokens ?? 0) > 0 ||
          (c.usage?.reasoningChars ?? 0) > 0,
      )
      .map((c) => ({ id: r.id, c })),
  );
  if (reasoned.length) {
    const byLabel = new Map<
      string,
      { calls: number; tokens: number; chars: number; ms: number }
    >();
    for (const { c } of reasoned) {
      const k = c.label ?? c.kind;
      const e = byLabel.get(k) ?? { calls: 0, tokens: 0, chars: 0, ms: 0 };
      e.calls++;
      e.tokens += c.usage?.reasoningTokens ?? 0;
      e.chars += c.usage?.reasoningChars ?? 0;
      e.ms += c.ms;
      byLabel.set(k, e);
    }
    merged.set('reasoning-measured', {
      severity: 'gargalo',
      title: 'O modelo gera raciocínio que o app descarta',
      detail: `${reasoned.length} chamadas geraram raciocínio antes da resposta. Por etapa: ${[
        ...byLabel.entries(),
      ]
        .map(
          ([k, e]) =>
            `${k} ${e.calls}× (${e.tokens ? `${n(e.tokens)} tokens` : `~${n(Math.round(e.chars / 3.5))} tokens, ${n(e.chars)} caracteres`}, ${sec(e.ms)} no total)`,
        )
        .join(
          '; ',
        )}. Desligar o raciocínio nas chamadas estruturadas muda o comportamento do modelo, então precisa de decisão e da avaliação.`,
      cases: [...new Set(reasoned.map((h) => h.id))],
    });
  }

  /* Estimated, for calls the server reported nothing about. */
  const hidden = results.flatMap((r) =>
    r.llm
      .filter((c) => !hasUsage(c) && looksLikeHiddenReasoning(c))
      .map((c) => ({ id: r.id, c })),
  );
  if (hidden.length) {
    const structured = results.flatMap((r) =>
      r.llm.filter((c) => c.kind === 'generateObject' && !c.error),
    );
    const worst = hidden.reduce((a, b) =>
      b.c.ms / Math.max(b.c.outputChars, 1) >
      a.c.ms / Math.max(a.c.outputChars, 1)
        ? b
        : a,
    );
    const lost = hidden.reduce((t, h) => t + h.c.ms, 0);
    merged.set('hidden-reasoning', {
      severity: 'gargalo',
      title: 'O modelo raciocina escondido nas chamadas estruturadas',
      detail: `${hidden.length} de ${structured.length} chamadas estruturadas levaram ${sec(HIDDEN_REASONING_MIN_MS)} ou mais para devolver poucos caracteres (pior: ${worst.c.label ?? 'generateObject'} em ${worst.id}, ${sec(worst.c.ms)} para ${worst.c.outputChars} caracteres). Somam ${sec(lost)}. O tempo vai em tokens de raciocínio que o app descarta. Desligar o raciocínio nessas chamadas (no LM Studio ou por chamada) costuma levar cada uma para 1 a 3 s; muda o comportamento do modelo, então precisa de decisão e da avaliação.`,
      cases: [...new Set(hidden.map((h) => h.id))],
    });
  }

  if (ok.length && !findings.some((f) => f.severity === 'bug'))
    merged.set('ok', {
      severity: 'sugestao',
      title: 'Nenhum bug encontrado',
      detail: `${ok.length} de ${rows.length} testes terminaram sem erro e sem citação quebrada.`,
      cases: [],
    });

  const order: Severity[] = ['bug', 'gargalo', 'aviso', 'sugestao'];
  return {
    rows,
    findings: [...merged.values()].sort(
      (a, b) => order.indexOf(a.severity) - order.indexOf(b.severity),
    ),
  };
};
