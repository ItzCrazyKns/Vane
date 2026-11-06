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

const pageHttp = (r: CaseResult) =>
  r.http.filter((h) => h.target === 'firecrawl' || h.target === 'other');
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
    searchBusyMs: union(r.http.filter((h) => h.target === 'searxng')),
    pagesBusyMs: union(pageHttp(r)),
    llmCalls: r.llm.length,
    llmCallsByKind: r.llm.reduce<Record<string, number>>(
      (a, c) => ((a[c.kind] = (a[c.kind] ?? 0) + 1), a),
      {},
    ),
    embeddingCalls: r.embedding.length,
    embeddedTexts: r.embedding.reduce((n, e) => n + e.texts, 0),
    searchRequests: r.http.filter((h) => h.target === 'searxng').length,
    pageRequests: pageHttp(r).length,
    sources: r.resultCount,
    answerChars: visibleAnswer(r.answer).length,
    maxPromptChars: Math.max(0, ...r.llm.map((c) => c.inputChars)),
    writerCharsPerSec:
      lastWriter && genMs > 500
        ? Math.round(lastWriter.outputChars / (genMs / 1000))
        : null,
  };
};

/* LM Studio and Ollama often default to a 4096-token context; ~3.5 chars per
   token is a rough average for Portuguese/English text. */
const SMALL_CONTEXT_CHARS = 4096 * 3.5;

/* Below this total, percentage-based bottleneck rules are noise. */
const MIN_MS_FOR_SHARE = 3000;

export const analyze = (
  results: CaseResult[],
  env?: { searchProvider: string; searxngConfigured: boolean },
) => {
  const rows = results.map(breakdown);
  const findings: Finding[] = [];
  const add = (f: Finding) => findings.push(f);

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
    if (bad.length)
      add({
        severity: 'bug',
        title: 'Citação para fonte inexistente',
        detail: `Citou ${[...new Set(bad)].map((n) => `[${n}]`).join(', ')} com ${r.sources.length} fontes. O link da citação fica quebrado.`,
        cases: [r.id],
      });

    if (r.expectSkipSearch && (r.sources.length > 0 || searx.length > 0))
      add({
        severity: 'aviso',
        title: 'Buscou quando não precisava',
        detail: `"${r.query}" deveria ser respondida sem busca (widget/modelo), mas houve ${searx.length} consultas. O classificador gastou tempo à toa.`,
        cases: [r.id],
      });
    if (!r.expectSkipSearch && r.id !== 'weather' && r.sources.length === 0)
      add({
        severity: searxFail.length ? 'bug' : 'aviso',
        title: 'Busca sem fontes',
        detail: searx.length
          ? `Nenhuma fonte chegou ao redator (${searx.length} consultas à SearxNG). A resposta veio só do conhecimento do modelo.`
          : 'O classificador decidiu não buscar nada para uma pergunta que precisa de fontes, então a resposta veio só do conhecimento do modelo.',
        cases: [r.id],
      });

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

    if (b.maxPromptChars > SMALL_CONTEXT_CHARS)
      add({
        severity: 'aviso',
        title: 'Prompt maior que um contexto de 4096 tokens',
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

    if (searx.length && b.searchBusyMs / searx.length > 3000)
      add({
        severity: 'gargalo',
        title: 'SearxNG lenta',
        detail: `Média de ${sec(b.searchBusyMs / searx.length)} por consulta (${searx.length} consultas). Desligar motores lentos ou baixar o timeout na SearxNG ajuda.`,
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

    if (b.writerCharsPerSec !== null && b.writerCharsPerSec < 40)
      add({
        severity: 'gargalo',
        title: 'Geração da resposta lenta',
        detail: `O redator escreveu ~${b.writerCharsPerSec} caracteres/s (~${Math.round(b.writerCharsPerSec / 3.5)} tokens/s). Um modelo menor ou quantizado, ou GPU offload completo no LM Studio, acelera a resposta.`,
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
  const classifier = results.flatMap((r) =>
    r.llm.filter((c) => c.kind === 'generateObject').slice(0, 1),
  );
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
