import { SearchAgentConfig } from './types';

export type SearchMode = SearchAgentConfig['mode'];

/**
 * What each mode spends on research, in one place (Perplexity exposes the
 * same idea as effort levels: fast, low, medium, high). Tuning a mode
 * means changing its row here instead of hunting for `mode === ...`.
 */
export type EffortPreset = {
  /** Researcher tool-calling iterations before the answer is written. */
  maxIterations: number;
  /** Top pages of each web search whose best passages are read (0 = none). */
  readPages: number;
  /**
   * Skip the researcher's LLM call when the classifier already proposed
   * search queries: search with them directly and go to the answer.
   */
  fastPath: boolean;
};

export const EFFORT_PRESETS: Record<SearchMode, EffortPreset> = {
  speed: { maxIterations: 2, readPages: 0, fastPath: true },
  balanced: { maxIterations: 6, readPages: 2, fastPath: false },
  quality: { maxIterations: 25, readPages: 0, fastPath: false },
};

export const getEffort = (mode: SearchMode): EffortPreset =>
  EFFORT_PRESETS[mode] ?? EFFORT_PRESETS.speed;

/** Queries the classifier may hand to the fast path. */
export const MAX_FAST_PATH_QUERIES = 3;
