import BaseEmbedding from '../../base/embedding';
import OpenAI from 'openai';

type DeepSeekEmbeddingConfig = {
  apiKey: string;
  model: string;
  baseURL?: string;
};

class DeepSeekEmbedding extends BaseEmbedding<DeepSeekEmbeddingConfig> {
  deepseekClient: OpenAI;

  constructor(protected config: DeepSeekEmbeddingConfig) {
    super(config);

    this.deepseekClient = new OpenAI({
      apiKey: this.config.apiKey,
      baseURL: this.config.baseURL || 'https://api.deepseek.com/v1',
    });
  }

  async embedDocuments(documents: string[]): Promise<number[][]> {
    const response = await this.deepseekClient.embeddings.create({
      model: this.config.model,
      input: documents,
    });

    return response.data.map((item) => item.embedding);
  }

  async embedQuery(document: string): Promise<number[]> {
    const response = await this.deepseekClient.embeddings.create({
      model: this.config.model,
      input: [document],
    });

    return response.data[0].embedding;
  }
}

export default DeepSeekEmbedding;
