import { Chunk } from '@/lib/types';
import BaseEmbedding from '../../base/embedding';
import { FeatureExtractionPipeline } from '@huggingface/transformers';

type TransformerConfig = {
  model: string;
};

/* One pipeline per model for the whole process. A new TransformerEmbedding is
   created for every request (ModelRegistry.loadEmbeddingModel), so caching the
   pipeline on the instance meant every request loaded its own ONNX session
   that was never released, and memory grew until the process was killed. */
const pipelines = new Map<string, Promise<FeatureExtractionPipeline>>();

class TransformerEmbedding extends BaseEmbedding<TransformerConfig> {
  constructor(protected config: TransformerConfig) {
    super(config);
  }

  async embedText(texts: string[]): Promise<number[][]> {
    return this.embed(texts);
  }

  async embedChunks(chunks: Chunk[]): Promise<number[][]> {
    return this.embed(chunks.map((c) => c.content));
  }

  private async embed(texts: string[]) {
    const model = this.config.model;
    let pipelinePromise = pipelines.get(model);

    if (!pipelinePromise) {
      const loading = (async () => {
        const { pipeline } = await import('@huggingface/transformers');
        const result = await pipeline('feature-extraction', model, {
          dtype: 'fp32',
        });
        return result as FeatureExtractionPipeline;
      })();
      pipelines.set(model, loading);
      /* A failed load is forgotten so the next request can try again. */
      loading.catch(() => {
        if (pipelines.get(model) === loading) pipelines.delete(model);
      });
      pipelinePromise = loading;
    }

    const pipe = await pipelinePromise;
    const output = await pipe(texts, { pooling: 'mean', normalize: true });
    return output.tolist() as number[][];
  }
}

export default TransformerEmbedding;
