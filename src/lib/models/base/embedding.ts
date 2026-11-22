import { createHash } from 'node:crypto';
import type { Chunk } from '@/lib/types';

abstract class BaseEmbedding<CONFIG extends { model: string }> {
  constructor(protected config: CONFIG) {}
  abstract embedText(texts: string[]): Promise<number[][]>;
  abstract embedChunks(chunks: Chunk[]): Promise<number[][]>;
  protected abstract getIndexEndpoint(): string | null;

  getIndexFingerprint(providerId: string): string {
    let endpoint: string | null = null;
    try {
      const requestURL = this.getIndexEndpoint();
      if (requestURL !== null) {
        const url = new URL(requestURL);
        if (url.protocol !== 'http:' && url.protocol !== 'https:') {
          throw new Error('Unsupported URL protocol');
        }

        // The SDK resolves the request URL. Exclude userinfo and fragments.
        endpoint = `${url.origin}${url.pathname}${url.search}`;
      }
    } catch {
      throw new Error('Invalid embedding endpoint');
    }

    const identity = JSON.stringify([providerId, this.config.model, endpoint]);
    return `v1:${createHash('sha256').update(identity).digest('hex')}`;
  }
}

export default BaseEmbedding;
