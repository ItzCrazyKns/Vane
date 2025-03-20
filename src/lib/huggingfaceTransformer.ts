import { Embeddings, type EmbeddingsParams } from '@langchain/core/embeddings';
import { chunkArray } from '@langchain/core/utils/chunk_array';

export interface HuggingFaceTransformersEmbeddingsParams
  extends EmbeddingsParams {
  modelName: string;

  model: string;

  timeout?: number;

  batchSize?: number;

  stripNewLines?: boolean;
}

export class HuggingFaceTransformersEmbeddings
  extends Embeddings
  implements HuggingFaceTransformersEmbeddingsParams
{
  modelName = 'Xenova/all-MiniLM-L6-v2';

  model = 'Xenova/all-MiniLM-L6-v2';

  batchSize = 512;

  stripNewLines = true;

  timeout?: number;

  private pipelinePromise: Promise<any> | undefined;

  constructor(fields?: Partial<HuggingFaceTransformersEmbeddingsParams>) {
    super(fields ?? {});

    this.modelName = fields?.model ?? fields?.modelName ?? this.model;
    this.model = this.modelName;
    this.stripNewLines = fields?.stripNewLines ?? this.stripNewLines;
    this.timeout = fields?.timeout;
  }

  async embedDocuments(texts: string[]): Promise<number[][]> {
    const batches = chunkArray(
      this.stripNewLines ? texts.map((t) => t.replace(/\n/g, ' ')) : texts,
      this.batchSize,
    );

    const batchRequests = batches.map((batch) => this.runEmbedding(batch));
    const batchResponses = await Promise.all(batchRequests);
    const embeddings: number[][] = [];

    for (let i = 0; i < batchResponses.length; i += 1) {
      const batchResponse = batchResponses[i];
      for (let j = 0; j < batchResponse.length; j += 1) {
        embeddings.push(batchResponse[j]);
      }
    }

    return embeddings;
  }

  async embedQuery(text: string): Promise<number[]> {
    const data = await this.runEmbedding([
      this.stripNewLines ? text.replace(/\n/g, ' ') : text,
    ]);
    return data[0];
  }

  private async runEmbedding(texts: string[]) {
    const { pipeline } = await import('@xenova/transformers');

    const pipe = await (this.pipelinePromise ??= pipeline(
      'feature-extraction',
      this.model,
    ));

    return this.caller.call(async () => {
      const output = await pipe(texts, { pooling: 'mean', normalize: true });
      return output.tolist();
    });
  }
}
