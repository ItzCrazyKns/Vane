import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { getAvailableEmbeddingModelProviders } from '@/lib/providers';
import { PDFLoader } from '@langchain/community/document_loaders/fs/pdf';
import { DocxLoader } from '@langchain/community/document_loaders/fs/docx';
import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters';
import { Document } from 'langchain/document';

interface FileRes {
  fileName: string;
  fileExtension: string;
  fileId: string;
}

const uploadDir = path.join(process.cwd(), 'uploads');

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const splitter = new RecursiveCharacterTextSplitter({
  chunkSize: 500,
  chunkOverlap: 100,
});

export async function POST(req: Request) {
  try {
    const formData = await req.formData();

    const files = formData.getAll('files') as File[];
    const embedding_model = formData.get('embedding_model');
    const embedding_model_provider = formData.get('embedding_model_provider');

    if (!embedding_model || !embedding_model_provider) {
      return NextResponse.json(
        { message: 'Missing embedding model or provider' },
        { status: 400 },
      );
    }

    const embeddingModels = await getAvailableEmbeddingModelProviders();
    const provider =
      embedding_model_provider ?? Object.keys(embeddingModels)[0];
    const embeddingModel =
      embedding_model ?? Object.keys(embeddingModels[provider as string])[0];

    let embeddingsModel =
      embeddingModels[provider as string]?.[embeddingModel as string]?.model;
    if (!embeddingsModel) {
      return NextResponse.json(
        { message: 'Invalid embedding model selected' },
        { status: 400 },
      );
    }

    const processedFiles: FileRes[] = [];

    await Promise.all(
      files.map(async (file: any) => {
        const fileExtension = file.name.split('.').pop();
        if (!['pdf', 'docx', 'txt'].includes(fileExtension!)) {
          return NextResponse.json(
            { message: 'File type not supported' },
            { status: 400 },
          );
        }

        const uniqueFileName = `${crypto.randomBytes(16).toString('hex')}.${fileExtension}`;
        const filePath = path.join(uploadDir, uniqueFileName);

        const buffer = Buffer.from(await file.arrayBuffer());
        fs.writeFileSync(filePath, new Uint8Array(buffer));

        let docs: any[] = [];
        if (fileExtension === 'pdf') {
          const loader = new PDFLoader(filePath);
          docs = await loader.load();
        } else if (fileExtension === 'docx') {
          const loader = new DocxLoader(filePath);
          docs = await loader.load();
        } else if (fileExtension === 'txt') {
          const text = fs.readFileSync(filePath, 'utf-8');
          docs = [
            new Document({ pageContent: text, metadata: { title: file.name } }),
          ];
        }

        const splitted = await splitter.splitDocuments(docs);

        const extractedDataPath = filePath.replace(/\.\w+$/, '-extracted.json');
        fs.writeFileSync(
          extractedDataPath,
          JSON.stringify({
            title: file.name,
            contents: splitted.map((doc) => doc.pageContent),
          }),
        );

        const embeddings = await embeddingsModel.embedDocuments(
          splitted.map((doc) => doc.pageContent),
        );
        const embeddingsDataPath = filePath.replace(
          /\.\w+$/,
          '-embeddings.json',
        );
        fs.writeFileSync(
          embeddingsDataPath,
          JSON.stringify({
            title: file.name,
            embeddings,
          }),
        );

        processedFiles.push({
          fileName: file.name,
          fileExtension: fileExtension,
          fileId: uniqueFileName.replace(/\.\w+$/, ''),
        });
      }),
    );

    return NextResponse.json({
      files: processedFiles,
    });
  } catch (error) {
    console.error('Error uploading file:', error);
    return NextResponse.json(
      { message: 'An error has occurred.' },
      { status: 500 },
    );
  }
}
