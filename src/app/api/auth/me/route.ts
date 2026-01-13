import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { users } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { migrateUserSettings } from '@/lib/migrations/migrate-user-settings';
import { requireUser, handleAuthRouteError } from '@/lib/auth/helpers';

export async function GET() {
  try {
    const authUser = await requireUser();

    // Migrate user settings if needed (runs only once per user)
    await migrateUserSettings(authUser.userId);

    const user = await db.query.users.findFirst({
      where: eq(users.id, authUser.userId),
    });

    if (!user) {
      return NextResponse.json({ message: 'User not found' }, { status: 404 });
    }

    return NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        settings: user.settings,
      },
    });
  } catch (error) {
    return handleAuthRouteError(error, 'Get user');
  }
}
