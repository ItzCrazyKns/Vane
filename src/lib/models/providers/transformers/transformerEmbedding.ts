import { Chunk } from '@/lib/types';
import BaseEmbedding from '../../base/embedding';
import { FeatureExtractionPipeline } from '@huggingface/transformers';

type TransformerConfig = {
  model: string;
};

/* Pipelines shared by the whole process, one per model. A TransformerEmbedding
   is created for every request (ModelRegistry.loadEmbeddingModel), and before
   this cache each instance loaded its own ONNX session (about 90 MB for
   MiniLM) that was never freed: 30 requests took the server to 3.7 GB and
   the OOM killer.

   The cache holds at most MAX_LOADED_MODELS. Loading one more evicts the
   least recently used; an evicted pipeline is disposed once no request is
   still embedding with it, so switching models does not grow memory. */
export const MAX_LOADED_MODELS = 2;

type Entry = {
  pipeline: Promise<FeatureExtractionPipeline>;
  inUse: number; // embed calls running on this pipeline right now
  evicted: boolean;
};

// Map order is use order: the first key is the least recently used.
const pipelines = new Map<string, Entry>();

// Frees an evicted pipeline's ONNX session once it is idle.
const disposeIfIdle = (entry: Entry) => {
  if (!entry.evicted || entry.inUse > 0) return;
  entry.pipeline.then((pipe) => pipe.dispose()).catch(() => undefined); // a failed load has nothing to free
};

const acquire = (model: string): Entry => {
  let entry = pipelines.get(model);

  if (entry) {
    // Move to the end: most recently used.
    pipelines.delete(model);
  } else {
    const pipeline = (async () => {
      const { pipeline } = await import('@huggingface/transformers');
      const result = await pipeline('feature-extraction', model, {
        dtype: 'fp32',
      });
      return result as FeatureExtractionPipeline;
    })();
    entry = { pipeline, inUse: 0, evicted: false };

    // A failed load is forgotten so the next request can try again.
    const loading = entry;
    pipeline.catch(() => {
      if (pipelines.get(model) === loading) pipelines.delete(model);
    });
  }

  pipelines.set(model, entry);

  while (pipelines.size > MAX_LOADED_MODELS) {
    const [oldest, old] = pipelines.entries().next().value!;
    pipelines.delete(oldest);
    old.evicted = true;
    disposeIfIdle(old);
  }

  entry.inUse++;
  return entry;
};

const release = (entry: Entry) => {
  entry.inUse--;
  disposeIfIdle(entry);
};

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
    const entry = acquire(this.config.model);

    try {
      const pipe = await entry.pipeline;
      const output = await pipe(texts, { pooling: 'mean', normalize: true });
      return output.tolist() as number[][];
    } finally {
      release(entry);
    }
  }
}

export default TransformerEmbedding;
