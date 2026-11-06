import type { Chunk, Message, ToolMessage } from '@/lib/types';
import { estimateMessagesTokens, estimateTokens } from './budget';

/** Above this share of the budget, old tool results are cleared. */
export const CLEAR_THRESHOLD = 0.75;
/** Tool results kept whole when clearing (the most recent ones). */
export const KEEP_RECENT_TOOL_RESULTS = 2;
/** Titles/URLs listed in the one-line stub of a cleared search result. */
const STUB_MAX_SOURCES = 5;
const STUB_TITLE_MAX_CHARS = 80;
const TRUNCATION_NOTE = '\n[...truncated to fit the context window]';

export type CompactionReport = {
  /** Estimated prompt tokens before and after. */
  before: number;
  after: number;
  /** Tool results replaced by a stub. */
  cleared: number;
  /** Tool results cut short because clearing was not enough. */
  truncated: number;
};

/**
 * One-line stand-in for a tool result that leaves the history. It keeps
 * the titles and URLs so the researcher still knows what it has already
 * read and does not search for it again.
 */
export const stubForToolResult = (message: ToolMessage): string => {
  let parsed: any;
  try {
    parsed = JSON.parse(message.content);
  } catch {
    return `[Earlier ${message.name} result removed to save context.]`;
  }

  const results: Chunk[] = Array.isArray(parsed?.results) ? parsed.results : [];

  if (results.length === 0) {
    return `[Earlier ${message.name} result removed to save context.]`;
  }

  const listed = results
    .slice(0, STUB_MAX_SOURCES)
    .map((r) => {
      const title = String(r?.metadata?.title ?? '').slice(
        0,
        STUB_TITLE_MAX_CHARS,
      );
      const url = r?.metadata?.url ?? '';
      return `${title} (${url})`.trim();
    })
    .join('; ');
  const more =
    results.length > STUB_MAX_SOURCES
      ? ` and ${results.length - STUB_MAX_SOURCES} more`
      : '';

  return `[Earlier ${message.name} result removed to save context. It had ${results.length} result(s): ${listed}${more}. Their content is kept for the final answer.]`;
};

const truncateToTokens = (text: string, maxTokens: number): string => {
  if (estimateTokens(text) <= maxTokens) return text;
  /* Characters per token varies; shrink until it fits. */
  let end = Math.max(
    0,
    Math.floor(text.length * (maxTokens / estimateTokens(text))),
  );
  let cut = text.slice(0, end);
  while (end > 0 && estimateTokens(cut + TRUNCATION_NOTE) > maxTokens) {
    end = Math.floor(end * 0.9);
    cut = text.slice(0, end);
  }
  return cut + TRUNCATION_NOTE;
};

/**
 * Keeps the researcher's history inside `budget` tokens (the prompt budget,
 * system prompt included via `fixedTokens`).
 *
 * - Below 75% of the budget nothing changes.
 * - Above it, tool results older than the last two are replaced by a
 *   one-line stub (no LLM call). Tool messages stay in place, so every
 *   tool call still has its answer.
 * - If that is still over the budget, the remaining tool results are
 *   stubbed too, newest last, and as a last resort the newest one is cut.
 *
 * The history is not mutated; a new array is returned. Search results
 * themselves are unaffected: the writer reads them from the action output,
 * not from this history.
 */
export const compactResearchHistory = (
  history: Message[],
  budget: number,
  fixedTokens = 0,
): { history: Message[]; report: CompactionReport } => {
  const total = (msgs: Message[]) => fixedTokens + estimateMessagesTokens(msgs);
  const before = total(history);
  const report: CompactionReport = {
    before,
    after: before,
    cleared: 0,
    truncated: 0,
  };

  if (before <= budget * CLEAR_THRESHOLD) {
    return { history, report };
  }

  const result = history.map((m) => ({ ...m })) as Message[];
  const toolIndexes = result
    .map((m, i) => (m.role === 'tool' ? i : -1))
    .filter((i) => i !== -1);

  const clear = (index: number) => {
    const msg = result[index] as ToolMessage;
    const stub = stubForToolResult(msg);
    if (stub !== msg.content) {
      msg.content = stub;
      report.cleared += 1;
    }
  };

  /* Stage 1: clear all but the most recent tool results. */
  toolIndexes
    .slice(0, Math.max(0, toolIndexes.length - KEEP_RECENT_TOOL_RESULTS))
    .forEach(clear);

  /* Stage 2: still over budget, clear the recent ones too, oldest first. */
  const recent = toolIndexes.slice(-KEEP_RECENT_TOOL_RESULTS);
  for (const index of recent) {
    if (total(result) <= budget) break;
    clear(index);
  }

  /* Stage 3: the newest tool result itself is too large; cut it. */
  if (total(result) > budget && toolIndexes.length > 0) {
    const last = toolIndexes[toolIndexes.length - 1];
    const msg = result[last] as ToolMessage;
    const others = total(result) - estimateTokens(msg.content);
    const room = Math.max(0, budget - others);
    msg.content = truncateToTokens(msg.content, room);
    report.truncated += 1;
  }

  report.after = total(result);
  return { history: result, report };
};

/**
 * Fits the writer's sources into `budget` tokens. Order is preserved so the
 * citation numbers still match the sources shown in the UI; sources past
 * the budget are dropped from the prompt only, and when even the first ones
 * do not fit, each gets an equal share and is cut to it.
 */
export const fitSourcesToBudget = (
  sources: Chunk[],
  budget: number,
  formatSource: (source: Chunk, index: number) => string,
): { sources: Chunk[]; dropped: number; truncated: number } => {
  const costs = sources.map((s, i) => estimateTokens(formatSource(s, i)));
  const totalCost = costs.reduce((a, b) => a + b, 0);

  if (totalCost <= budget) {
    return { sources, dropped: 0, truncated: 0 };
  }

  /* Keep at most budget / MIN_SHARE sources so each kept one still says
     something; fewer sources are kept instead of many empty ones. */
  const MIN_SHARE = 300;
  const keep = Math.max(
    1,
    Math.min(sources.length, Math.floor(budget / MIN_SHARE)),
  );

  /* Water-filling: find the largest cap such that the kept sources, each
     cut to at most `cap`, fit. Short sources stay whole and leave their
     unused share to the long ones. */
  const kept = costs.slice(0, keep);
  const ascending = [...kept].sort((a, b) => a - b);
  let cap = Math.floor(budget / keep);
  let remaining = budget;
  for (let i = 0; i < ascending.length; i++) {
    const evenShare = Math.floor(remaining / (ascending.length - i));
    if (ascending[i] > evenShare) {
      cap = evenShare;
      break;
    }
    remaining -= ascending[i];
    cap = Infinity;
  }

  let truncated = 0;
  const fitted = sources.slice(0, keep).map((s, i) => {
    if (costs[i] <= cap) return s;
    truncated += 1;
    const overhead = estimateTokens(formatSource({ ...s, content: '' }, i));
    return {
      ...s,
      content: truncateToTokens(s.content, Math.max(0, cap - overhead)),
    };
  });

  return { sources: fitted, dropped: sources.length - keep, truncated };
};
