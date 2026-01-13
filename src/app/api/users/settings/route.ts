import { NextRequest, NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth/helpers';
import db from '@/lib/db';
import { users } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

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

    // Fetch current settings first
    const userData = await db.query.users.findFirst({
      where: eq(users.id, user.userId),
      columns: { settings: true },
    });

    // Merge new settings with existing settings
    const mergedSettings = {
      ...(userData?.settings || {}),
      ...body.settings,
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
    console.error('Failed to update user settings:', err);
    return NextResponse.json(
      { message: 'Failed to update user settings' },
      { status: 500 },
    );
  }
}
