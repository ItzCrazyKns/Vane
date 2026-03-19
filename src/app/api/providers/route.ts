import ModelRegistry from '@/lib/models/registry';
import { getAuthEnabled, isAdmin } from '@/lib/auth';
import configManager from '@/lib/config';
import { NextRequest } from 'next/server';

export const GET = async (req: Request) => {
  try {
    const registry = new ModelRegistry();

    const activeProviders = await registry.getActiveProviders();

    let filteredProviders = activeProviders.filter((p) => {
      return !p.chatModels.some((m) => m.key === 'error');
    });

    // Filter out restricted models for non-admin users
    const authEnabled = getAuthEnabled();
    const userId = req.headers.get('x-user-id');
    if (authEnabled && userId) {
      const admin = await isAdmin(userId);
      if (!admin) {
        const restricted = configManager.getRestrictedModels();
        if (restricted.length > 0) {
          filteredProviders = filteredProviders.map((p) => ({
            ...p,
            chatModels: p.chatModels.filter(
              (m) =>
                !restricted.some(
                  (r) => r.providerId === p.id && r.modelKey === m.key,
                ),
            ),
          }));
        }
      }
    }

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
    // Admin-only when auth is enabled
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
