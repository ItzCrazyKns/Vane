import { requireAdmin } from '@/lib/auth';
import configManager from '@/lib/config';

export const POST = async (req: Request) => {
  const result = await requireAdmin(req);
  if ('error' in result) return result.error;

  const body = await req.json();
  const { restrictedModels } = body;

  if (!Array.isArray(restrictedModels)) {
    return Response.json(
      { message: 'restrictedModels must be an array.' },
      { status: 400 },
    );
  }

  configManager.setRestrictedModels(restrictedModels);
  return Response.json({ message: 'Restricted models updated' });
};
