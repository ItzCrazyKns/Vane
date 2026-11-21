import BaseEmbedding from "../models/base/embedding";
import UploadManager from "./manager";
import computeSimilarity from "../utils/computeSimilarity";
import { Chunk } from "../types";

type UploadStoreParams = {
    embeddingModel: BaseEmbedding<any>;
    fileIds: string[];
}

type StoreRecord = {
    embedding: number[];
    content: string;
    fileId: string;
    metadata: Record<string, any>
}

class UploadStore {
    embeddingModel: BaseEmbedding<any>;
    fileIds: string[];
    records: StoreRecord[] = [];

    constructor(private params: UploadStoreParams) {
        this.embeddingModel = params.embeddingModel;
        this.fileIds = params.fileIds;
        this.initializeStore()
    }

    initializeStore() {
        new Set(this.fileIds).forEach((fileId) => {
            const file = UploadManager.getFile(fileId)

            if (!file) {
                throw new Error(`File with ID ${fileId} not found`);
            }

            const chunks = UploadManager.getFileChunks(fileId);

            this.records.push(...chunks.map((chunk) => ({
                embedding: chunk.embedding,
                content: chunk.content,
                fileId: fileId,
                metadata: {
                    fileName: file.name,
                    title: file.name,
                    url: `file_id://${file.id}`,
                }
            })))
        })
    }

    async query(queries: string[], topK: number): Promise<Chunk[]> {
        const queryEmbeddings = await this.embeddingModel.embedText(queries);

        // 所有查询共享同一批片段，片段在记录数组中的位置可作为本次检索的标识。
        const scoresByRecord = new Map<number, number>();
        const rankOffset = 60;

        for (const queryEmbedding of queryEmbeddings) {
            const rankedRecords = this.records
                .map((record, recordIndex) => ({
                    recordIndex,
                    score: computeSimilarity(queryEmbedding, record.embedding),
                }))
                .sort((a, b) => b.score - a.score);

            rankedRecords.forEach(({ recordIndex, score }, rankIndex) => {
                const previousScore = scoresByRecord.get(recordIndex) || 0;
                const contribution = score / (rankIndex + 1 + rankOffset);
                scoresByRecord.set(recordIndex, previousScore + contribution);
            });
        }

        return Array.from(scoresByRecord.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, topK)
            .map(([recordIndex]) => {
                const { content, metadata, fileId } = this.records[recordIndex];
                return { content, metadata: { ...metadata, fileId } };
            });
    }

    static getFileData(fileIds: string[]): { fileName: string; initialContent: string }[] {
        const filesData: { fileName: string; initialContent: string }[] = [];

        fileIds.forEach((fileId) => {
            const file = UploadManager.getFile(fileId)

            if (!file) {
                throw new Error(`File with ID ${fileId} not found`);
            }

            const chunks = UploadManager.getFileChunks(fileId);

            filesData.push({
                fileName: file.name,
                initialContent: chunks.slice(0, 3).map(c => c.content).join('\n---\n'),
            })
        })

        return filesData
    }
}

export default UploadStore