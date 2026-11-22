import BaseEmbedding from '../models/base/embedding';
import UploadManager from './manager';
import computeSimilarity from '../utils/computeSimilarity';
import { Chunk } from '../types';
import { hashObj } from '../utils/hash';

type UploadStoreParams = {
  embeddingModel: BaseEmbedding<any>;
  fileIds: string[];
  fingerprint: string;
};

type Attachment = { fileId: string; fileName: string; canReindex?: false };

export class AttachmentReindexRequired extends Error {
  readonly code = 'ATTACHMENT_REINDEX_REQUIRED';

  constructor(readonly files: Attachment[]) {
    super(
      'Some attachments need to be reindexed for the selected embedding model.',
    );
  }

  toResponse() {
    return { code: this.code, message: this.message, files: this.files };
  }
}

type StoreRecord = {
  embedding: number[];
  content: string;
  fileId: string;
  metadata: Record<string, any>;
};

class UploadStore {
  private records: StoreRecord[] = [];
  private indexedFiles: (Attachment & { dimensions: number })[] = [];
  private previews: { fileName: string; initialContent: string }[] = [];

  constructor(private params: UploadStoreParams) {
    this.initializeStore();
  }

  private initializeStore() {
    const incompatible: Attachment[] = [];

    // Let the prompt and every query in this turn use the same checked index.
    for (const fileId of new Set(this.params.fileIds)) {
      const file = UploadManager.getFile(fileId);
      const attachment = { fileId, fileName: file?.name ?? 'Uploaded file' };
      if (!file) {
        incompatible.push({ ...attachment, canReindex: false });
        continue;
      }

      let index;
      try {
        index = UploadManager.getFileIndex(file);
      } catch {
        incompatible.push({ ...attachment, canReindex: false });
        continue;
      }

      const { embeddingFingerprint, dimensions, chunks } = index;
      if (chunks.some((chunk) => typeof chunk?.content !== 'string')) {
        incompatible.push({ ...attachment, canReindex: false });
        continue;
      }
      if (
        embeddingFingerprint !== this.params.fingerprint ||
        dimensions === undefined ||
        !Number.isInteger(dimensions) ||
        (chunks.length === 0 ? dimensions !== 0 : dimensions <= 0) ||
        chunks.some(
          (chunk) =>
            !Array.isArray(chunk.embedding) ||
            chunk.embedding.length !== dimensions,
        )
      ) {
        incompatible.push(attachment);
        continue;
      }

      if (chunks.length) this.indexedFiles.push({ ...attachment, dimensions });
      this.previews.push({
        fileName: file.name,
        initialContent: chunks
          .slice(0, 3)
          .map((chunk) => chunk.content)
          .join('\n---\n'),
      });

      for (const chunk of chunks) {
        this.records.push({
          embedding: chunk.embedding,
          content: chunk.content,
          fileId,
          metadata: {
            fileName: file.name,
            title: file.name,
            url: `file_id://${fileId}`,
          },
        });
      }
    }

    if (incompatible.length) throw new AttachmentReindexRequired(incompatible);
  }

  async query(queries: string[], topK: number): Promise<Chunk[]> {
    if (!this.records.length || !queries.length) return [];

    const queryEmbeddings = await this.params.embeddingModel.embedText(queries);
    if (queryEmbeddings.length !== queries.length) {
      throw new Error('Embeddings and query count mismatch');
    }
    if (
      queryEmbeddings.some(
        (query) => !Array.isArray(query) || !query.every(Number.isFinite),
      )
    ) {
      throw new Error('Invalid query embedding');
    }

    const incompatible = this.indexedFiles.filter((file) =>
      queryEmbeddings.some((query) => query.length !== file.dimensions),
    );
    if (incompatible.length) {
      throw new AttachmentReindexRequired(
        incompatible.map(({ fileId, fileName }) => ({ fileId, fileName })),
      );
    }

    const results: { chunk: Chunk; score: number }[][] = [];
    const hashResults: string[][] = [];

    await Promise.all(
      queryEmbeddings.map(async (query) => {
        const similarities = this.records
          .map((record, idx) => {
            return {
              chunk: {
                content: record.content,
                metadata: {
                  ...record.metadata,
                  fileId: record.fileId,
                },
              },
              score: computeSimilarity(query, record.embedding),
            } as { chunk: Chunk; score: number };
          })
          .sort((a, b) => b.score - a.score);

        results.push(similarities);
        hashResults.push(similarities.map((s) => hashObj(s)));
      }),
    );

    const chunkMap: Map<string, Chunk> = new Map();
    const scoreMap: Map<string, number> = new Map();
    const k = 60;

    for (let i = 0; i < results.length; i++) {
      for (let j = 0; j < results[i].length; j++) {
        const chunkHash = hashResults[i][j];

        chunkMap.set(chunkHash, results[i][j].chunk);
        scoreMap.set(
          chunkHash,
          (scoreMap.get(chunkHash) || 0) + results[i][j].score / (j + 1 + k),
        );
      }
    }

    const finalResults = Array.from(scoreMap.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([chunkHash, _score]) => {
        return chunkMap.get(chunkHash)!;
      });

    return finalResults.slice(0, topK);
  }

  getFileData() {
    return this.previews;
  }
}

export default UploadStore;
