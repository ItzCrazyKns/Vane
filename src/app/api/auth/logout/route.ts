import { NextRequest, NextResponse } from 'next/server';
import { clearAuthCookie } from '@/lib/auth';
import { handleAuthRouteError, getRequestUser } from '@/lib/auth/helpers';
import { logLogout } from '@/lib/auth/audit';

export async function POST(req: NextRequest) {
  try {
    const user = await getRequestUser();

    await clearAuthCookie();

    // Log logout if user was authenticated
    if (user) {
      logLogout(user.userId, req.headers);
    }

    return NextResponse.json({ message: 'Logged out successfully' });
  } catch (error) {
    return handleAuthRouteError(error, 'Logout');
  }
}
