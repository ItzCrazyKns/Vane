import ModelRegistry from '@/lib/models/registry';
import { NextRequest } from 'next/server';
import { requireAdmin, getRequestUser, isAuthError } from '@/lib/auth/helpers';
import configManager from '@/lib/config';

export const GET = async (req: Request) => {
  try {
    // After setup is complete, require authentication to read providers
    // During setup, allow public access (needed for setup wizard)
    if (configManager.isSetupComplete()) {
      const user = await getRequestUser();
      if (!user) {
        return Response.json(
          { message: 'Authentication required' },
          { status: 401 },
        );
      }
    }

    const registry = new ModelRegistry();

    const activeProviders = await registry.getActiveProviders();

    const filteredProviders = activeProviders.filter((p) => {
      return !p.chatModels.some((m) => m.key === 'error');
    });

    return Response.json(
      {
        providers: filteredProviders,
      },
      {
        status: 200,
      },
    );
  } catch (err) {
    console.error('An error occurred while fetching providers', err);
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

export const POST = async (req: NextRequest) => {
  try {
    // Only admins can add providers (during setup, allow unauthenticated access)
    if (configManager.isSetupComplete()) {
      await requireAdmin();
    }

    const body = await req.json();
    const { type, name, config } = body;

    if (!type || !name || !config) {
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

    const newProvider = await registry.addProvider(type, name, config);

    return Response.json(
      {
        provider: newProvider,
      },
      {
        status: 200,
      },
    );
  } catch (err) {
    if (isAuthError(err)) {
      return Response.json({ message: err.message }, { status: err.status });
    }
    console.error('An error occurred while creating provider', err);
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
