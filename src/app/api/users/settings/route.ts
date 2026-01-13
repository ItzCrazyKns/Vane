import { NextRequest, NextResponse } from 'next/server';
import { requireUser, isAuthError } from '@/lib/auth/helpers';
import db from '@/lib/db';
import { users } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Schema for validating user settings - only allow known keys with correct types
const settingsSchema = z
  .object({
    theme: z.enum(['light', 'dark']).optional(),
    measureUnit: z.enum(['Imperial', 'Metric']).optional(),
    autoMediaSearch: z.boolean().optional(),
    showWeatherWidget: z.boolean().optional(),
    showNewsWidget: z.boolean().optional(),
    systemInstructions: z.string().max(10000).optional(),
  })
  .strict(); // Reject unknown keys

export async function GET(req: NextRequest) {
  try {
    const user = await requireUser();

    const userData = await db.query.users.findFirst({
      where: eq(users.id, user.userId),
      columns: { settings: true },
    });

    return NextResponse.json({
      settings: userData?.settings || {},
    });
  } catch (err) {
    if (isAuthError(err)) {
      return NextResponse.json({ message: err.message }, { status: err.status });
    }
    console.error('Failed to fetch user settings:', err);
    return NextResponse.json(
      { message: 'Failed to fetch user settings' },
      { status: 500 },
    );
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const user = await requireUser();
    const body = await req.json();

    // Validate incoming settings against schema
    const parseResult = settingsSchema.safeParse(body.settings);
    if (!parseResult.success) {
      return NextResponse.json(
        {
          message: 'Invalid settings',
          errors: parseResult.error.flatten().fieldErrors,
        },
        { status: 400 },
      );
    }

    const validatedSettings = parseResult.data;

    // Fetch current settings first
    const userData = await db.query.users.findFirst({
      where: eq(users.id, user.userId),
      columns: { settings: true },
    });

    // Merge validated settings with existing settings
    const mergedSettings = {
      ...(userData?.settings || {}),
      ...validatedSettings,
    };

    await db
      .update(users)
      .set({
        settings: mergedSettings,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(users.id, user.userId));

    return NextResponse.json({ success: true });
  } catch (err) {
    if (isAuthError(err)) {
      return NextResponse.json({ message: err.message }, { status: err.status });
    }
    console.error('Failed to update user settings:', err);
    return NextResponse.json(
      { message: 'Failed to update user settings' },
      { status: 500 },
    );
  }
}
