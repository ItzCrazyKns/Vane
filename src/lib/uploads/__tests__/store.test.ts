import { describe, expect, it, vi } from 'vitest';
import { FakeEmbedding } from '@/__tests__/helpers/fakes';

const files: Record<string, { name: string; chunks: string[] }> = {
  f1: {
    name: 'relatorio.txt',
    chunks: [
      'rust memory safety',
      'go goroutines concurrency',
      'web rust go',
      'tokio async rust',
    ],
  },
};

vi.mock('@/lib/uploads/manager', async () => {
  const { embedDeterministic } = await import('@/__tests__/helpers/fakes');
  return {
    default: {
      getFile: (id: string) =>
        files[id] ? { id, name: files[id].name } : null,
      getFileChunks: (id: string) =>
        files[id].chunks.map((content) => ({
          content,
          embedding: embedDeterministic(content),
        })),
    },
  };
});

import UploadStore from '../store';

describe('UploadStore.query', () => {
  it('ranks chunks by reciprocal-rank fusion over the queries (current behavior)', async () => {
    const embedding = new FakeEmbedding();
    const store = new UploadStore({ embeddingModel: embedding, fileIds: ['f1'] });

    const results = await store.query(['rust', 'go concurrency'], 10);

    // One batched embedding call for all queries.
    expect(embedding.calls).toEqual([['rust', 'go concurrency']]);
    expect(results[0].metadata).toMatchObject({
      fileName: 'relatorio.txt',
      title: 'relatorio.txt',
      url: 'file_id://f1',
      fileId: 'f1',
    });
    // Documents the current behavior. hashObj passes the sorted top-level
    // keys as the JSON.stringify replacer, which also filters nested keys,
    // so a result hashes as {"chunk":{},"score":x}: only the score counts.
    // Different chunks with the same score collapse into one entry, and the
    // same chunk from two queries (different scores) is never fused.
    // Here "rust memory safety", "web rust go" and "tokio async rust" all
    // score 1/sqrt(3) for "rust" and collapse into the last one seen.
    expect(results.map((r) => r.content)).toMatchInlineSnapshot(`
      [
        "tokio async rust",
        "go goroutines concurrency",
        "web rust go",
        "tokio async rust",
      ]
    `);
  });

  it('respects topK', async () => {
    const store = new UploadStore({
      embeddingModel: new FakeEmbedding(),
      fileIds: ['f1'],
    });
    expect(await store.query(['rust'], 2)).toHaveLength(2);
  });

  it('throws for an unknown file id', () => {
    expect(
      () =>
        new UploadStore({ embeddingModel: new FakeEmbedding(), fileIds: ['x'] }),
    ).toThrow('File with ID x not found');
  });
});
