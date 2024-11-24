import express from 'express';
import logger from '../utils/logger';
import multer from 'multer';
import path from 'path';
import crypto from 'crypto';
import fs from 'fs';
import { Embeddings } from '@langchain/core/embeddings';
import { getAvailableEmbeddingModelProviders } from '../lib/providers';
import { PDFLoader } from '@langchain/community/document_loaders/fs/pdf';
import { DocxLoader } from '@langchain/community/document_loaders/fs/docx';
import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters';
import { Document } from 'langchain/document';

const router = express.Router();

const splitter = new RecursiveCharacterTextSplitter({
  chunkSize: 500,
  chunkOverlap: 100,
});

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(process.cwd(), './uploads'));
  },
  filename: (req, file, cb) => {
    const splitedFileName = file.originalname.split('.');
    const fileExtension = splitedFileName[splitedFileName.length - 1];
    if (!['pdf', 'docx', 'txt'].includes(fileExtension)) {
      return cb(new Error('File type is not supported'), '');
    }
    cb(null, `${crypto.randomBytes(16).toString('hex')}.${fileExtension}`);
  },
});

const upload = multer({ storage });

router.post(
  '/',
  upload.fields([
    { name: 'files' },
    { name: 'embedding_model', maxCount: 1 },
    { name: 'embedding_model_provider', maxCount: 1 },
  ]),
  async (req, res) => {
    try {
      const { embedding_model, embedding_model_provider } = req.body;

      if (!embedding_model || !embedding_model_provider) {
        res
          .status(400)
          .json({ message: 'Missing embedding model or provider' });
        return;
      }

      const embeddingModels = await getAvailableEmbeddingModelProviders();
      const provider =
        embedding_model_provider ?? Object.keys(embeddingModels)[0];
      const embeddingModel: Embeddings =
        embedding_model ?? Object.keys(embeddingModels[provider])[0];

      let embeddingsModel: Embeddings | undefined;

      if (
        embeddingModels[provider] &&
        embeddingModels[provider][embeddingModel]
      ) {
        embeddingsModel = embeddingModels[provider][embeddingModel].model as
          | Embeddings
          | undefined;
      }

      if (!embeddingsModel) {
        res.status(400).json({ message: 'Invalid LLM model selected' });
        return;
      }

      const files = req.files['files'] as Express.Multer.File[];
      if (!files || files.length === 0) {
        res.status(400).json({ message: 'No files uploaded' });
        return;
      }

      await Promise.all(
        files.map(async (file) => {
          let docs: Document[] = [];

          if (file.mimetype === 'application/pdf') {
            const loader = new PDFLoader(file.path);
            docs = await loader.load();
          } else if (
            file.mimetype ===
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
          ) {
            const loader = new DocxLoader(file.path);
            docs = await loader.load();
          } else if (file.mimetype === 'text/plain') {
            const text = fs.readFileSync(file.path, 'utf-8');
            docs = [
              new Document({
                pageContent: text,
                metadata: {
                  title: file.originalname,
                },
              }),
            ];
          }

          const splitted = await splitter.splitDocuments(docs);

          const json = JSON.stringify({
            title: file.originalname,
            contents: splitted.map((doc) => doc.pageContent),
          });

          const pathToSave = file.path.replace(/\.\w+$/, '-extracted.json');
          fs.writeFileSync(pathToSave, json);

          const embeddings = await embeddingsModel.embedDocuments(
            splitted.map((doc) => doc.pageContent),
          );

          const embeddingsJSON = JSON.stringify({
            title: file.originalname,
            embeddings: embeddings,
          });

          const pathToSaveEmbeddings = file.path.replace(
            /\.\w+$/,
            '-embeddings.json',
          );
          fs.writeFileSync(pathToSaveEmbeddings, embeddingsJSON);
        }),
      );

      res.status(200).json({
        files: files.map((file) => {
          return {
            fileName: file.originalname,
            fileExtension: file.filename.split('.').pop(),
            fileId: file.filename.replace(/\.\w+$/, ''),
          };
        }),
      });
    } catch (err: any) {
      logger.error(`Error in uploading file results: ${err.message}`);
      res.status(500).json({ message: 'An error has occurred.' });
    }
  },
);

export default router;
