import type { ResearchBlock } from '@/lib/types';

/** Queries a single search action may run. */
export const MAX_QUERIES_PER_CALL = 3;

/** Told to the model when every query it sent was empty or already run. */
export const NO_NEW_QUERIES_NOTE =
  'No search was run: the queries were empty or had already been searched in this research. Use different, specific queries, or call done if you have enough.';

const INVALID = new Set(['', 'undefined', 'null', 'none', '[]']);

const key = (q: string) => q.toLowerCase().replace(/\s+/g, ' ').trim();

/**
 * Cleans the `queries` argument a model sent to a search action.
 *
 * Small models sometimes send a string instead of an array, omit the field
 * (which used to search for the literal text "undefined"), or repeat a
 * query from an earlier step. This keeps only non-empty strings, drops
 * duplicates (case and spacing ignored), drops queries already searched in
 * this research block, and caps the list at three.
 */
export const normalizeQueries = (
  raw: unknown,
  researchBlock?: ResearchBlock,
  max = MAX_QUERIES_PER_CALL,
): string[] => {
  const list = (Array.isArray(raw) ? raw : [raw]).flat();

  const seen = new Set<string>();
  researchBlock?.data.subSteps.forEach((step) => {
    if (step.type === 'searching') {
      step.searching.forEach((q) => seen.add(key(q)));
    }
  });

  const queries: string[] = [];
  for (const item of list) {
    if (typeof item !== 'string') continue;
    const query = item.trim();
    const k = key(query);
    if (INVALID.has(k) || seen.has(k)) continue;
    seen.add(k);
    queries.push(query);
    if (queries.length >= max) break;
  }

  return queries;
};
