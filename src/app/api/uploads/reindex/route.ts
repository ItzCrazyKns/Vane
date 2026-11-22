import { z } from 'zod';
import ModelRegistry from '@/lib/models/registry';
import UploadManager from '@/lib/uploads/manager';

const bodySchema = z.object({
  fileId: z.string().min(1),
  embeddingModel: z.object({
    providerId: z.string().min(1),
    key: z.string().min(1),
  }),
});

const pendingReindexes = new Set<string>();

export async function POST(req: Request) {
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return Response.json(
      { message: 'Invalid reindex request' },
      { status: 400 },
    );
  }

  const { fileId, embeddingModel } = parsed.data;
  if (pendingReindexes.has(fileId)) {
    return Response.json(
      { message: 'This attachment is already being reindexed.' },
      { status: 409 },
    );
  }

  pendingReindexes.add(fileId);
  let step = 'read attachment';
  try {
    const file = UploadManager.getFile(fileId);
    if (!file) {
      return Response.json(
        { message: 'Attachment not found' },
        { status: 404 },
      );
    }

    step = 'load embedding model';
    const registry = new ModelRegistry();
    const model = await registry.loadEmbeddingModel(
      embeddingModel.providerId,
      embeddingModel.key,
    );
    const uploadManager = new UploadManager({
      embeddingModel: model,
      embeddingFingerprint: model.getIndexFingerprint(
        embeddingModel.providerId,
      ),
    });

    step = 'rebuild index';
    await uploadManager.reindexFile(file);
    return Response.json({ fileId });
  } catch (error) {
    // Provider errors may include request headers or document text.
    const status =
      error instanceof Error &&
      'status' in error &&
      typeof error.status === 'number'
        ? error.status
        : undefined;
    console.error('Unable to rebuild attachment index', {
      fileId,
      step,
      errorType: error instanceof Error ? error.constructor.name : 'Unknown',
      status,
    });
    return Response.json(
      {
        message:
          'Could not rebuild the attachment index. Check your embedding model and try again.',
      },
      { status: 500 },
    );
  } finally {
    pendingReindexes.delete(fileId);
  }
}
