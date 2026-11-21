const ARABIC_DIACRITICS_RE = /[\u064B-\u065F\u0670\u0640]/g;

const tokenizeUnicodeWords = (s: string): string[] =>
  s
    .normalize('NFKC')
    .replace(ARABIC_DIACRITICS_RE, '')
    .toLowerCase()
    .split(/[^\p{L}\p{M}\p{N}_]+/u)
    .filter(Boolean);

const computeJaccardSimilarity = (a: string, b: string): number => {
  const wordsA = tokenizeUnicodeWords(a);
  const wordsB = tokenizeUnicodeWords(b);

  const setA = new Set(wordsA);
  const setB = new Set(wordsB);

  if (setA.size === 0 || setB.size === 0) return 0;

  const union = setA.union(setB);
  const intersections = setA.intersection(setB);

  return intersections.size / union.size;
};

export default computeJaccardSimilarity;
