import cosineSimilarity from 'compute-cosine-similarity';

const computeSimilarity = (x: number[], y: number[]): number => {
  return cosineSimilarity(x, y) as number;
};

export default computeSimilarity;
