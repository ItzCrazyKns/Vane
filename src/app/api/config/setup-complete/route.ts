import configManager from '@/lib/config';
import { NextRequest } from 'next/server';

export const POST = async (req: NextRequest) => {
  try {
    // Prevent re-running setup after it's already complete
    if (configManager.isSetupComplete()) {
      return Response.json(
        { message: 'Setup has already been completed.' },
        { status: 400 },
      );
    }

    // Validate that essential configuration exists before marking complete
    const config = configManager.getCurrentConfig();
    const hasProviders = config.modelProviders && config.modelProviders.length > 0;

    if (!hasProviders) {
      return Response.json(
        { message: 'Cannot complete setup: At least one model provider must be configured.' },
        { status: 400 },
      );
    }

    configManager.markSetupComplete();

    return Response.json(
      {
        message: 'Setup marked as complete.',
      },
      {
        status: 200,
      },
    );
  } catch (err) {
    console.error('Error marking setup as complete: ', err);
    return Response.json(
      { message: 'An error has occurred.' },
      { status: 500 },
    );
  }
};
