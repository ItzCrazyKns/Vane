import path from 'path';
import type BaseEmbedding from '../models/base/embedding';
import crypto from 'crypto';
import fs from 'fs';
import { splitText } from '../utils/splitText';
import { PDFParse } from 'pdf-parse';
import { CanvasFactory } from 'pdf-parse/worker';
import officeParser from 'officeparser';

const supportedMimeTypes = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
] as const;

type SupportedMimeType = (typeof supportedMimeTypes)[number];

type UploadManagerParams = {
  embeddingModel: BaseEmbedding<any>;
  embeddingFingerprint: string;
};

type RecordedFile = {
  id: string;
  name: string;
  filePath: string;
  contentPath: string;
  uploadedAt: string;
};

type FileIndex = {
  embeddingFingerprint?: string;
  dimensions?: number;
  chunks: { content: string; embedding: number[] }[];
};

type FileRes = {
  fileName: string;
  fileExtension: string;
  fileId: string;
};

class UploadManager {
  static uploadsDir = path.join(process.cwd(), 'data', 'uploads');
  static uploadedFilesRecordPath = path.join(
    this.uploadsDir,
    'uploaded_files.json',
  );

  constructor(private params: UploadManagerParams) {
    fs.mkdirSync(UploadManager.uploadsDir, { recursive: true });

    if (!fs.existsSync(UploadManager.uploadedFilesRecordPath)) {
      fs.writeFileSync(
        UploadManager.uploadedFilesRecordPath,
        JSON.stringify({ files: [] }, null, 2),
      );
    }
  }

  private static getRecordedFiles(): RecordedFile[] {
    try {
      const data = fs.readFileSync(
        UploadManager.uploadedFilesRecordPath,
        'utf-8',
      );
      return JSON.parse(data).files;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
      throw error;
    }
  }

  private static addNewRecordedFile(fileRecord: RecordedFile) {
    const currentData = this.getRecordedFiles();

    currentData.push(fileRecord);

    fs.writeFileSync(
      UploadManager.uploadedFilesRecordPath,
      JSON.stringify({ files: currentData }, null, 2),
    );
  }

  static getFile(fileId: string): RecordedFile | null {
    const recordedFiles = this.getRecordedFiles();

    return recordedFiles.find((file) => file.id === fileId) || null;
  }

  static getFileIndex(file: { contentPath: string }): FileIndex {
    const index = JSON.parse(fs.readFileSync(file.contentPath, 'utf-8'));

    if (!Array.isArray(index?.chunks)) {
      throw new Error('Invalid attachment index');
    }

    return index;
  }

  private async extractText(
    filePath: string,
    fileType: SupportedMimeType,
  ): Promise<string> {
    switch (fileType) {
      case 'text/plain':
        return fs.readFileSync(filePath, 'utf-8');
      case 'application/pdf': {
        const parser = new PDFParse({
          data: fs.readFileSync(filePath),
          CanvasFactory,
        });
        return (await parser.getText()).text;
      }
      case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
        return (
          await officeParser.parseOffice(fs.readFileSync(filePath))
        ).toText();
      default:
        throw new Error(`Unsupported file type: ${fileType}`);
    }
  }

  private async writeIndex(contentPath: string, texts: string[]) {
    const embeddings =
      texts.length > 0 ? await this.params.embeddingModel.embedText(texts) : [];

    if (embeddings.length !== texts.length) {
      throw new Error('Embeddings and text chunks length mismatch');
    }

    const dimensions = embeddings[0]?.length ?? 0;
    if (
      embeddings.some(
        (vector) =>
          !Array.isArray(vector) ||
          dimensions === 0 ||
          vector.length !== dimensions ||
          !vector.every(Number.isFinite),
      )
    ) {
      throw new Error('Invalid attachment embeddings');
    }

    const index: FileIndex = {
      embeddingFingerprint: this.params.embeddingFingerprint,
      dimensions,
      chunks: texts.map((content, i) => ({
        content,
        embedding: embeddings[i],
      })),
    };

    // 将模型身份和向量一起发布，失败时保留原索引。
    const tempPath = `${contentPath}.${crypto.randomUUID()}.tmp`;
    try {
      await fs.promises.writeFile(tempPath, JSON.stringify(index, null, 2));
      await fs.promises.rename(tempPath, contentPath);
    } catch (error) {
      await fs.promises.rm(tempPath, { force: true }).catch(() => {});
      throw error;
    }
  }

  async reindexFile(file: RecordedFile): Promise<void> {
    const { chunks } = UploadManager.getFileIndex(file);
    const texts = chunks.map((chunk) => chunk?.content);
    if (texts.some((text) => typeof text !== 'string')) {
      throw new Error('Invalid text chunks in attachment index');
    }

    await this.writeIndex(file.contentPath, texts);
  }

  async processFiles(files: File[]): Promise<FileRes[]> {
    const processedFiles: FileRes[] = [];

    await Promise.all(
      files.map(async (file) => {
        if (!(supportedMimeTypes as readonly string[]).includes(file.type)) {
          throw new Error(`File type ${file.type} not supported`);
        }

        const fileId = crypto.randomBytes(16).toString('hex');
        const fileExtension = file.name.split('.').pop();
        const fileStem = crypto.randomBytes(16).toString('hex');
        const filePath = path.join(
          UploadManager.uploadsDir,
          `${fileStem}.${fileExtension}`,
        );
        const contentPath = path.join(
          UploadManager.uploadsDir,
          `${fileStem}.content.json`,
        );

        fs.writeFileSync(filePath, Buffer.from(await file.arrayBuffer()));

        const text = await this.extractText(
          filePath,
          file.type as SupportedMimeType,
        );
        await this.writeIndex(contentPath, splitText(text, 512, 128));

        UploadManager.addNewRecordedFile({
          id: fileId,
          name: file.name,
          filePath,
          contentPath,
          uploadedAt: new Date().toISOString(),
        });

        processedFiles.push({
          fileExtension: fileExtension || '',
          fileId,
          fileName: file.name,
        });
      }),
    );

    return processedFiles;
  }
}

export default UploadManager;
