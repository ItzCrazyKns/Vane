import dot from 'compute-dot';
import cosineSimilarity from 'compute-cosine-similarity';
import { getSimilarityMeasure } from '../config';

const computeSimilarity = (x: number[], y: number[]): number => {
  const similarityMeasure = getSimilarityMeasure();

  if (similarityMeasure === 'cosine') {
    return cosineSimilarity(x, y) as number;
  } else if (similarityMeasure === 'dot') {
    return dot(x, y);
  }

  throw new Error('Invalid similarity measure');
};

export default computeSimilarity;
