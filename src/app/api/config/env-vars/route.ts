import configManager from '@/lib/config';
import { NextRequest, NextResponse } from 'next/server';

export const GET = async (req: NextRequest) => {
  try {
    const envVars = configManager.getEnvVars();

    return NextResponse.json({
      envVars,
    });
  } catch (err) {
    console.error('Error in getting env vars: ', err);
    return Response.json(
      { message: 'An error has occurred.' },
      { status: 500 },
    );
  }
};
