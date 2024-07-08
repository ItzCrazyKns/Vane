import logger from '../../utils/logger';
import { HuggingFaceTransformersEmbeddings } from '../huggingfaceTransformer';

export const loadTransformersEmbeddingsModels = async () => {
  try {
    const embeddingModels = {
      'BGE Small': new HuggingFaceTransformersEmbeddings({
        modelName: 'Xenova/bge-small-en-v1.5',
      }),
      'GTE Small': new HuggingFaceTransformersEmbeddings({
        modelName: 'Xenova/gte-small',
      }),
      'Bert Multilingual': new HuggingFaceTransformersEmbeddings({
        modelName: 'Xenova/bert-base-multilingual-uncased',
      }),
    };

    return embeddingModels;
  } catch (err) {
    logger.error(`Error loading Transformers embeddings model: ${err}`);
    return {};
  }
};
