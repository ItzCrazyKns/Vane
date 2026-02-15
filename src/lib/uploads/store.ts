import BaseEmbedding from "../models/base/embedding";
import UploadManager from "./manager";
import computeSimilarity from "../utils/computeSimilarity";
import { Chunk } from "../types";
import { hashObj } from "../serverUtils";

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
        this.fileIds.forEach((fileId) => {
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
        const queryEmbeddings = await this.embeddingModel.embedText(queries)

        const results: { chunk: Chunk; score: number; }[][] = [];
        const hashResults: string[][] = []

        await Promise.all(queryEmbeddings.map(async (query) => {
            const similarities = this.records.map((record) => {
                return {
                    chunk: {
                        content: record.content,
                        metadata: {
                            ...record.metadata,
                            fileId: record.fileId,
                        }
                    },
                    score: computeSimilarity(query, record.embedding)
                } as { chunk: Chunk; score: number; };
            }).sort((a, b) => b.score - a.score)

            results.push(similarities)
            hashResults.push(similarities.map(s => hashObj(s)))
        }))

        const chunkMap: Map<string, Chunk> = new Map();
        const scoreMap: Map<string, number> = new Map();
        const k = 60;

        for (let i = 0; i < results.length; i++) {
            for (let j = 0; j < results[i].length; j++) {
                const chunkHash = hashResults[i][j]

                chunkMap.set(chunkHash, results[i][j].chunk);
                scoreMap.set(chunkHash, (scoreMap.get(chunkHash) || 0) + results[i][j].score / (j + 1 + k));
            }
        }

        const finalResults = Array.from(scoreMap.entries())
            .sort((a, b) => b[1] - a[1])
            .map(([chunkHash, _score]) => {
                return chunkMap.get(chunkHash)!;
            })

        return finalResults.slice(0, topK);
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
