import dot from 'compute-dot';
import cosineSimilarity from 'compute-cosine-similarity';

const computeSimilarity = (x: number[], y: number[]): number => {
  if (process.env.SIMILARITY_MEASURE === 'cosine') {
    return cosineSimilarity(x, y);
  } else if (process.env.SIMILARITY_MEASURE === 'dot') {
    return dot(x, y);
  }

  throw new Error('Invalid similarity measure');
};

export default computeSimilarity;
