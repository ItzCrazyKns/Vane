import ModelRegistry from '@/lib/models/registry';
import { NextRequest } from 'next/server';
import { requireAdmin, isAuthError } from '@/lib/auth/helpers';

export const DELETE = async (
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) => {
  try {
    // Only admins can delete providers
    await requireAdmin();

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
    if (isAuthError(err)) {
      return Response.json({ message: err.message }, { status: err.status });
    }
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
    // Only admins can update providers
    await requireAdmin();

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
    if (isAuthError(err)) {
      return Response.json({ message: err.message }, { status: err.status });
    }
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
