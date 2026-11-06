/* Opt-in tracing for the settings benchmark. Search code reports counts at
   each step (results per query, how many the similarity filter kept, how
   many sources reached the writer) and labels the LLM calls it makes.
   Outside runTraced() every function here is a no-op, so normal requests
   pay nothing and record nothing. Events carry counts only: never query
   text, page content or anything the user wrote. */
import { AsyncLocalStorage } from 'node:async_hooks';

export type TraceEvent =
  | {
      type: 'search_query';
      mode: string;
      /** Results the engine returned for the query (after the domain filter). */
      results: number;
      /** Results kept after the similarity filter (speed/balanced). */
      kept: number;
      /** The filter dropped everything and the best ones were kept instead. */
      fallback: boolean;
      embeddingError?: boolean;
      simMax?: number;
      simMedian?: number;
      simMin?: number;
    }
  | {
      type: 'search_merge';
      mode: string;
      /** Results of every query of the call, before deduplication. */
      scored: number;
      /** After dropping repeated URLs and near-identical results. */
      unique: number;
      /** Returned to the researcher. */
      returned: number;
    }
  | { type: 'research_iteration'; iteration: number; actions: string[] }
  | {
      type: 'writer_sources';
      /** Sources the research produced. */
      found: number;
      /** Sources that fit in the writer's context. */
      kept: number;
      /** Characters of source text sent to the writer. */
      contextChars: number;
    };

/** What an LLM call is for: classifier, widget, researcher, writer... */
export type TraceLabel = string;

/** Token counts a provider reports for one call (any field may be missing). */
export type Usage = {
  promptTokens?: number;
  completionTokens?: number;
  /** Reasoning tokens, when the server counts them separately. */
  reasoningTokens?: number;
  /** Characters of reasoning text the server sent and the app discards. */
  reasoningChars?: number;
  /** Server-side time generating the answer (Ollama reports it). */
  generationMs?: number;
  /** Server-side time reading the prompt (Ollama reports it). */
  promptMs?: number;
};

type Ctx = {
  emit: (e: TraceEvent) => void;
  label?: TraceLabel;
  usage?: (u: Usage) => void;
};

const store = new AsyncLocalStorage<Ctx>();

/** Records an event when tracing. Pass a function to skip the work of
    building the event when nobody is listening. */
export const trace = (e: TraceEvent | (() => TraceEvent)) => {
  const ctx = store.getStore();
  if (ctx) ctx.emit(typeof e === 'function' ? e() : e);
};

export const runTraced = <T>(emit: (e: TraceEvent) => void, fn: () => T): T =>
  store.run({ emit }, fn);

/** Runs fn with its LLM calls labelled; a plain call when not tracing. */
export const withTraceLabel = <T>(label: TraceLabel, fn: () => T): T => {
  const ctx = store.getStore();
  return ctx ? store.run({ ...ctx, label }, fn) : fn();
};

export const currentTraceLabel = (): TraceLabel | undefined =>
  store.getStore()?.label;

/** True inside a benchmark call that wants token counts. Providers ask the
    server for usage in streams only then, so normal requests are unchanged. */
export const isUsageTracked = () => store.getStore()?.usage !== undefined;

/** Providers call this with what the server reported; no-op otherwise. */
export const reportUsage = (u: Usage) => store.getStore()?.usage?.(u);

/** Runs fn with reportUsage() going to sink; a plain call when not tracing. */
export const withUsageSink = <T>(sink: (u: Usage) => void, fn: () => T): T => {
  const ctx = store.getStore();
  return ctx ? store.run({ ...ctx, usage: sink }, fn) : fn();
};
