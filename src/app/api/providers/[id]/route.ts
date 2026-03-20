import ModelRegistry from '@/lib/models/registry';
import { getAuthEnabled, isAdmin } from '@/lib/auth';
import configManager from '@/lib/config';
import { NextRequest } from 'next/server';

const adminGuard = async (req: NextRequest) => {
  const authEnabled = getAuthEnabled();
  if (authEnabled && configManager.isSetupComplete()) {
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

export const DELETE = async (
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) => {
  try {
    const guard = await adminGuard(req);
    if (guard) return guard;

    const { id } = await params;

    if (!id) {
      return Response.json(
        {
          message: 'Provider ID is required.',
        },
        {
          status: 400,
        },
      );
    }

    const registry = new ModelRegistry();
    await registry.removeProvider(id);

    return Response.json(
      {
        message: 'Provider deleted successfully.',
      },
      {
        status: 200,
      },
    );
  } catch (err: any) {
    console.error('An error occurred while deleting provider', err.message);
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

export const PATCH = async (
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) => {
  try {
    const guard = await adminGuard(req);
    if (guard) return guard;

    const body = await req.json();
    const { name, config } = body;
    const { id } = await params;

    if (!id || !name || !config) {
      return Response.json(
        {
          message: 'Missing required fields.',
        },
        {
          status: 400,
        },
      );
    }

    const registry = new ModelRegistry();

    const updatedProvider = await registry.updateProvider(id, name, config);

    return Response.json(
      {
        provider: updatedProvider,
      },
      {
        status: 200,
      },
    );
  } catch (err: any) {
    console.error('An error occurred while updating provider', err.message);
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
