import { Ollama } from 'ollama';
import BaseEmbedding from '../../base/embedding';
import { Chunk } from '@/lib/types';

type OllamaConfig = {
  model: string;
  baseURL?: string;
};

class OllamaEmbeddingClient extends Ollama {
  get embeddingEndpoint(): string {
    return `${this.config.host}/api/embed`;
  }
}

class OllamaEmbedding extends BaseEmbedding<OllamaConfig> {
  ollamaClient: OllamaEmbeddingClient;

  constructor(protected config: OllamaConfig) {
    super(config);

    this.ollamaClient = new OllamaEmbeddingClient({
      host: this.config.baseURL || 'http://localhost:11434',
    });
  }

  protected getIndexEndpoint(): string {
    return this.ollamaClient.embeddingEndpoint;
  }

  async embedText(texts: string[]): Promise<number[][]> {
    const response = await this.ollamaClient.embed({
      input: texts,
      model: this.config.model,
    });

    return response.embeddings;
  }

  async embedChunks(chunks: Chunk[]): Promise<number[][]> {
    const response = await this.ollamaClient.embed({
      input: chunks.map((c) => c.content),
      model: this.config.model,
    });

    return response.embeddings;
  }
}

export default OllamaEmbedding;
