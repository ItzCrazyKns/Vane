import { requireAdmin } from '@/lib/auth';
import configManager from '@/lib/config';

export const POST = async (req: Request) => {
  try {
    const result = await requireAdmin(req);
    if ('error' in result) return result.error;

    let body;
    try {
      body = await req.json();
    } catch {
      return Response.json(
        { message: 'Invalid JSON body.' },
        { status: 400 },
      );
    }

    const { restrictedModels } = body;

    if (!Array.isArray(restrictedModels)) {
      return Response.json(
        { message: 'restrictedModels must be an array.' },
        { status: 400 },
      );
    }

    const isValidShape = restrictedModels.every(
      (m: any) =>
        typeof m === 'object' &&
        m !== null &&
        typeof m.providerId === 'string' &&
        typeof m.modelKey === 'string',
    );
    if (!isValidShape) {
      return Response.json(
        { message: 'Each entry must have string providerId and modelKey.' },
        { status: 400 },
      );
    }

    configManager.setRestrictedModels(restrictedModels);
    return Response.json({ message: 'Restricted models updated' });
  } catch (err) {
    console.error('Error updating restricted models:', err);
    return Response.json(
      { message: 'An error has occurred.' },
      { status: 500 },
    );
  }
};
