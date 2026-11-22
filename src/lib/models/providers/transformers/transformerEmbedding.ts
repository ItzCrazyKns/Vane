import { Chunk } from '@/lib/types';
import BaseEmbedding from '../../base/embedding';
import { FeatureExtractionPipeline } from '@huggingface/transformers';

type TransformerConfig = {
  model: string;
};

class TransformerEmbedding extends BaseEmbedding<TransformerConfig> {
  private pipelinePromise: Promise<FeatureExtractionPipeline> | null = null;

  constructor(protected config: TransformerConfig) {
    super(config);
  }

  protected getIndexEndpoint(): null {
    return null;
  }

  async embedText(texts: string[]): Promise<number[][]> {
    return this.embed(texts);
  }

  async embedChunks(chunks: Chunk[]): Promise<number[][]> {
    return this.embed(chunks.map((c) => c.content));
  }

  private async embed(texts: string[]) {
    if (!this.pipelinePromise) {
      this.pipelinePromise = (async () => {
        const { pipeline } = await import('@huggingface/transformers');
        const result = await pipeline('feature-extraction', this.config.model, {
          dtype: 'fp32',
        });
        return result as FeatureExtractionPipeline;
      })();
    }

    const pipe = await this.pipelinePromise;
    const output = await pipe(texts, { pooling: 'mean', normalize: true });
    return output.tolist() as number[][];
  }
}

export default TransformerEmbedding;
