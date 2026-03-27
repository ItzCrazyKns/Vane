import OpenAI from 'openai';
import BaseEmbedding from '../../base/embedding';
import { Chunk } from '@/lib/types';

type OpenAIConfig = {
  apiKey: string;
  model: string;
  baseURL?: string;
  timeout?: number;
};

class OpenAIEmbedding extends BaseEmbedding<OpenAIConfig> {
  openAIClient: OpenAI;

  constructor(protected config: OpenAIConfig) {
    super(config);

    this.openAIClient = new OpenAI({
      apiKey: config.apiKey,
      baseURL: config.baseURL,
      timeout: config.timeout,
    });
  }

  async embedText(texts: string[]): Promise<number[][]> {
    const response = await this.openAIClient.embeddings.create({
      model: this.config.model,
      input: texts,
    });

    return response.data.map((embedding) => embedding.embedding);
  }

  async embedChunks(chunks: Chunk[]): Promise<number[][]> {
    const response = await this.openAIClient.embeddings.create({
      model: this.config.model,
      input: chunks.map((c) => c.content),
    });

    return response.data.map((embedding) => embedding.embedding);
  }
}

export default OpenAIEmbedding;
