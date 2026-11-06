/**
 * Hybrid ranking for search results, in the spirit of Perplexity's
 * lexical + vector retrieval with a fusion step.
 *
 * Each query yields up to three rankings of its results: the engine's own
 * order, the embedding similarity to the query, and a keyword (lexical)
 * score against the query and the user's question. Reciprocal Rank Fusion
 * adds 1 / (k + rank) over every ranking a page appears in, and over every
 * query that found it, so a page several queries agree on rises to the
 * top. RRF needs no score calibration, which matters because cosine
 * similarities from different embedding models live on different scales.
 */

/** RRF constant from Cormack et al. (2009); damps the head of each list. */
export const RRF_K = 60;

const STOPWORDS = new Set(
  (
    'a an and are as at be by de do da das dos e em for from how in is it ' +
    'na nas no nos o os of on or para por que qual quais the to um uma ' +
    'what when where which who why with com sem como mais'
  ).split(' '),
);

/** Lowercase, accent-free word tokens without stopwords or 1-letter noise. */
export const tokenize = (text: string): string[] =>
  text
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter((t) => t.length > 1 && !STOPWORDS.has(t));

/**
 * Share of the query's distinct terms found in the result, with a title
 * hit worth twice a body hit. 0 when the query has no usable terms.
 */
export const lexicalScore = (
  query: string,
  title: string,
  content: string,
): number => {
  const terms = Array.from(new Set(tokenize(query)));
  if (terms.length === 0) return 0;

  const titleTerms = new Set(tokenize(title));
  const bodyTerms = new Set(tokenize(content));

  let score = 0;
  for (const t of terms) {
    if (titleTerms.has(t)) score += 2;
    else if (bodyTerms.has(t)) score += 1;
  }
  return score / (terms.length * 2);
};

/**
 * 1-based ranks of `scores`, best (highest) first. Equal scores share the
 * best rank of their group, so a list where everything ties adds the same
 * amount to every item and does not reorder them.
 */
export const ranksOf = (scores: number[]): number[] => {
  const order = scores
    .map((s, i) => ({ s, i }))
    .sort((a, b) => b.s - a.s || a.i - b.i);
  const ranks = new Array<number>(scores.length);
  let rank = 1;
  order.forEach((item, pos) => {
    if (pos > 0 && item.s !== order[pos - 1].s) rank = pos + 1;
    ranks[item.i] = rank;
  });
  return ranks;
};

/** RRF contribution of one item given its rank in each list. */
export const rrf = (ranks: number[], k = RRF_K) =>
  ranks.reduce((sum, r) => sum + 1 / (k + r), 0);

/**
 * Fused score of each result of one query. `similarities` is the cosine
 * to the query (all equal when embeddings failed); the engine order is the
 * array order.
 */
export const fuseQueryResults = (
  query: string,
  question: string | undefined,
  results: { title: string; content: string }[],
  similarities: number[],
): number[] => {
  const engineRanks = results.map((_, i) => i + 1);
  const vectorRanks = ranksOf(similarities);
  const lexicalText = question ? `${query} ${question}` : query;
  const lexicalRanks = ranksOf(
    results.map((r) => lexicalScore(lexicalText, r.title, r.content)),
  );

  return results.map((_, i) =>
    rrf([engineRanks[i], vectorRanks[i], lexicalRanks[i]]),
  );
};
