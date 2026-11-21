import type { Chunk } from '@/lib/types';

export type ResponseFormat = 'full' | 'summary-only' | 'metadata-only';

export const isResponseFormat = (value: unknown): value is ResponseFormat =>
  value === 'full' || value === 'summary-only' || value === 'metadata-only';

export const formatSearchSources = (
  sources: Chunk[],
  responseFormat: ResponseFormat,
) => {
  if (responseFormat === 'summary-only') return undefined;

  if (responseFormat === 'metadata-only') {
    return sources.map(({ metadata }) => ({
      metadata: {
        title: metadata.title,
        url: metadata.url,
      },
    }));
  }

  return sources;
};
