import ModelRegistry from '@/lib/models/registry';
import { Model } from '@/lib/models/types';
import { getAuthEnabled, isAdmin } from '@/lib/auth';
import { NextRequest } from 'next/server';

const adminGuard = async (req: NextRequest) => {
  const authEnabled = getAuthEnabled();
  if (authEnabled) {
    const userId = req.headers.get('x-user-id');
    if (!userId || !(await isAdmin(userId))) {
      return Response.json(
        { message: 'Admin access required.' },
        { status: 403 },
      );
    }
  }
  return null;
};

export const POST = async (
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) => {
  try {
    const guard = await adminGuard(req);
    if (guard) return guard;

    const { id } = await params;

    const body: Partial<Model> & { type: 'embedding' | 'chat' } =
      await req.json();

    if (!body.key || !body.name) {
      return Response.json(
        {
          message: 'Key and name must be provided',
        },
        {
          status: 400,
        },
      );
    }

    const registry = new ModelRegistry();

    await registry.addProviderModel(id, body.type, body);

    return Response.json(
      {
        message: 'Model added successfully',
      },
      {
        status: 200,
      },
    );
  } catch (err) {
    console.error('An error occurred while adding provider model', err);
    return Response.json(
      {
        message: 'An error has occurred.',
      },
      {
        status: 500,
      },
    );
  }
};

export const DELETE = async (
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) => {
  try {
    const guard = await adminGuard(req);
    if (guard) return guard;

    const { id } = await params;

    const body: { key: string; type: 'embedding' | 'chat' } = await req.json();

    if (!body.key) {
      return Response.json(
        {
          message: 'Key and name must be provided',
        },
        {
          status: 400,
        },
      );
    }

    const registry = new ModelRegistry();

    await registry.removeProviderModel(id, body.type, body.key);

    return Response.json(
      {
        message: 'Model deleted successfully',
      },
      {
        status: 200,
      },
    );
  } catch (err) {
    console.error('An error occurred while deleting provider model', err);
    return Response.json(
      {
        message: 'An error has occurred.',
      },
      {
        status: 500,
      },
    );
  }
};
