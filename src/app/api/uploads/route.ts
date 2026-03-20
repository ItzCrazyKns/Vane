import { NextResponse } from 'next/server';
import ModelRegistry from '@/lib/models/registry';
import UploadManager from '@/lib/uploads/manager';
import { getAuthEnabled } from '@/lib/auth';

export async function POST(req: Request) {
  try {
    const authEnabled = getAuthEnabled();
    if (authEnabled) {
      const userId = req.headers.get('x-user-id');
      if (!userId) {
        return NextResponse.json(
          { message: 'Authentication required' },
          { status: 401 },
        );
      }
    }

    const formData = await req.formData();

    const files = formData.getAll('files') as File[];
    const embeddingModel = formData.get('embedding_model_key') as string;
    const embeddingModelProvider = formData.get('embedding_model_provider_id') as string;

    if (!embeddingModel || !embeddingModelProvider) {
      return NextResponse.json(
        { message: 'Missing embedding model or provider' },
        { status: 400 },
      );
    }

    const registry = new ModelRegistry();

    const model = await registry.loadEmbeddingModel(embeddingModelProvider, embeddingModel);
    
    const uploadManager = new UploadManager({
      embeddingModel: model,
    })

    const processedFiles = await uploadManager.processFiles(files);

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
