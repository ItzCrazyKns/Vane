import path from "path";
import BaseEmbedding from "../models/base/embedding"
import crypto from "crypto"
import fs from 'fs';
import { splitText } from "../utils/splitText";
import { PDFParse } from 'pdf-parse';
import { CanvasFactory } from 'pdf-parse/worker';
import officeParser from 'officeparser'

const supportedMimeTypes = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain'] as const

type SupportedMimeType = typeof supportedMimeTypes[number];

type UploadManagerParams = {
    embeddingModel: BaseEmbedding<any>;
}

type RecordedFile = {
    id: string;
    userId: string | null;  // User who uploaded the file
    name: string;
    filePath: string;
    contentPath: string;
    uploadedAt: string;
}

type FileRes = {
    fileName: string;
    fileExtension: string;
    fileId: string;
}

class UploadManager {
    private embeddingModel: BaseEmbedding<any>;
    static uploadsDir = path.join(process.cwd(), 'data', 'uploads');
    static uploadedFilesRecordPath = path.join(this.uploadsDir, 'uploaded_files.json');

    constructor(private params: UploadManagerParams) {
        this.embeddingModel = params.embeddingModel;

        if (!fs.existsSync(UploadManager.uploadsDir)) {
            fs.mkdirSync(UploadManager.uploadsDir, { recursive: true });
        }

        if (!fs.existsSync(UploadManager.uploadedFilesRecordPath)) {
            const data = {
                files: []
            }

            fs.writeFileSync(UploadManager.uploadedFilesRecordPath, JSON.stringify(data, null, 2));
        }
    }

    private static getRecordedFiles(): RecordedFile[] {
        const data = fs.readFileSync(UploadManager.uploadedFilesRecordPath, 'utf-8');
        return JSON.parse(data).files;
    }

    private static addNewRecordedFile(fileRecord: RecordedFile) {
        const currentData = this.getRecordedFiles()

        currentData.push(fileRecord);

        fs.writeFileSync(UploadManager.uploadedFilesRecordPath, JSON.stringify({ files: currentData }, null, 2));
    }

    static getFile(fileId: string, userId?: string | null): RecordedFile | null {
        const recordedFiles = this.getRecordedFiles();
        const file = recordedFiles.find(f => f.id === fileId);

        if (!file) {
            return null;
        }

        // If userId is provided, verify ownership
        // Allow access if file has no owner (legacy files) or if userId matches
        if (userId !== undefined && file.userId !== null && file.userId !== userId) {
            console.warn(`Access denied: User ${userId} attempted to access file ${fileId} owned by ${file.userId}`);
            return null;
        }

        return file;
    }

    static getFileChunks(fileId: string, userId?: string | null): { content: string; embedding: number[] }[] {
        try {
            const recordedFile = this.getFile(fileId, userId);

            if (!recordedFile) {
                throw new Error(`File with ID ${fileId} not found or access denied`);
            }

            const contentData = JSON.parse(fs.readFileSync(recordedFile.contentPath, 'utf-8'))

            return contentData.chunks;
        } catch (err) {
            console.log('Error getting file chunks:', err);
            return [];
        }
    }

    private async extractContentAndEmbed(filePath: string, fileType: SupportedMimeType): Promise<string> {
        switch (fileType) {
            case 'text/plain':
                const content = fs.readFileSync(filePath, 'utf-8');

                const splittedText = splitText(content, 512, 128)
                const embeddings = await this.embeddingModel.embedText(splittedText)

                if (embeddings.length !== splittedText.length) {
                    throw new Error('Embeddings and text chunks length mismatch');
                }

                const contentPath = filePath.split('.').slice(0, -1).join('.') + '.content.json';

                const data = {
                    chunks: splittedText.map((text, i) => {
                        return {
                            content: text,
                            embedding: embeddings[i],
                        }
                    })
                }

                fs.writeFileSync(contentPath, JSON.stringify(data, null, 2));

                return contentPath;
            case 'application/pdf':
                const pdfBuffer = fs.readFileSync(filePath);

                const parser = new PDFParse({
                    data: pdfBuffer,
                    CanvasFactory
                })

                const pdfText = await parser.getText().then(res => res.text)

                const pdfSplittedText = splitText(pdfText, 512, 128)
                const pdfEmbeddings = await this.embeddingModel.embedText(pdfSplittedText)

                if (pdfEmbeddings.length !== pdfSplittedText.length) {
                    throw new Error('Embeddings and text chunks length mismatch');
                }

                const pdfContentPath = filePath.split('.').slice(0, -1).join('.') + '.content.json';

                const pdfData = {
                    chunks: pdfSplittedText.map((text, i) => {
                        return {
                            content: text,
                            embedding: pdfEmbeddings[i],
                        }
                    })
                }

                fs.writeFileSync(pdfContentPath, JSON.stringify(pdfData, null, 2));

                return pdfContentPath;
            case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
                const docBuffer = fs.readFileSync(filePath);

                const docText = await officeParser.parseOfficeAsync(docBuffer)

                const docSplittedText = splitText(docText, 512, 128)
                const docEmbeddings = await this.embeddingModel.embedText(docSplittedText)

                if (docEmbeddings.length !== docSplittedText.length) {
                    throw new Error('Embeddings and text chunks length mismatch');
                }

                const docContentPath = filePath.split('.').slice(0, -1).join('.') + '.content.json';

                const docData = {
                    chunks: docSplittedText.map((text, i) => {
                        return {
                            content: text,
                            embedding: docEmbeddings[i],
                        }
                    })
                }

                fs.writeFileSync(docContentPath, JSON.stringify(docData, null, 2));

                return docContentPath;
            default:
                throw new Error(`Unsupported file type: ${fileType}`);
        }
    }

    async processFiles(files: File[], userId?: string | null): Promise<FileRes[]> {
        const processedFiles: FileRes[] = [];

        await Promise.all(files.map(async (file) => {
            if (!(supportedMimeTypes as unknown as string[]).includes(file.type)) {
                throw new Error(`File type ${file.type} not supported`);
            }

            const fileId = crypto.randomBytes(16).toString('hex');

            const fileExtension = file.name.split('.').pop();
            const fileName = `${crypto.randomBytes(16).toString('hex')}.${fileExtension}`;
            const filePath = path.join(UploadManager.uploadsDir, fileName);

            const buffer = Buffer.from(await file.arrayBuffer())

            fs.writeFileSync(filePath, buffer);

            const contentFilePath = await this.extractContentAndEmbed(filePath, file.type as SupportedMimeType);

            const fileRecord: RecordedFile = {
                id: fileId,
                userId: userId || null,
                name: file.name,
                filePath: filePath,
                contentPath: contentFilePath,
                uploadedAt: new Date().toISOString(),
            }

            UploadManager.addNewRecordedFile(fileRecord);

            processedFiles.push({
                fileExtension: fileExtension || '',
                fileId,
                fileName: file.name
            });
        }))

        return processedFiles;
    }
}

export default UploadManager;