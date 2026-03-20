import configManager from '@/lib/config';
import { getAuthEnabled, requireAdmin } from '@/lib/auth';
import { NextRequest } from 'next/server';

export const POST = async (req: NextRequest) => {
  try {
    // During initial setup, allow unauthenticated access.
    // After setup is complete, only admins can call this (effectively a no-op).
    if (configManager.isSetupComplete()) {
      const authEnabled = getAuthEnabled();
      if (authEnabled) {
        const result = await requireAdmin(req);
        if ('error' in result) return result.error;
      }
    }

    configManager.markSetupComplete();

    return Response.json(
      { message: 'Setup marked as complete.' },
      { status: 200 },
    );
  } catch (err) {
    console.error('Error marking setup as complete: ', err);
    return Response.json(
      { message: 'An error has occurred.' },
      { status: 500 },
    );
  }
};
