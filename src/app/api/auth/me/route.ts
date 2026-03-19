import { getAuthEnabled, getUserById, getSession } from '@/lib/auth';
import { verifySessionCookie } from '@/lib/auth/cookie';

export const GET = async (req: Request) => {
  const authEnabled = getAuthEnabled();

  if (!authEnabled) {
    return Response.json({ user: null, authEnabled: false }, { status: 200 });
  }

  // This route is excluded from middleware (/api/auth/*), so we verify
  // the session cookie directly instead of relying on x-user-id header.
  try {
    const cookieHeader = req.headers.get('cookie') || '';
    const match = cookieHeader.match(/session_id=([^;]+)/);
    const cookie = match?.[1];

    if (!cookie) {
      return Response.json(
        { user: null, authEnabled: true },
        { status: 401 },
      );
    }

    const payload = await verifySessionCookie(cookie);

    if (!payload) {
      return Response.json(
        { user: null, authEnabled: true },
        { status: 401 },
      );
    }

    // Validate session against DB for revocation support
    const session = await getSession(payload.sessionId);
    if (!session) {
      return Response.json(
        { user: null, authEnabled: true },
        { status: 401 },
      );
    }

    const user = await getUserById(payload.userId);

    if (!user) {
      return Response.json(
        { user: null, authEnabled: true },
        { status: 401 },
      );
    }

    return Response.json(
      {
        user: {
          id: user.id,
          username: user.username,
          role: user.role,
        },
        authEnabled: true,
      },
      { status: 200 },
    );
  } catch (error) {
    console.error('Auth me error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
};
