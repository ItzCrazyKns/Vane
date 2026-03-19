import {
  getUserByUsername,
  verifyPassword,
  createSession,
  getAuthEnabled,
} from '@/lib/auth';
import { signSessionCookie } from '@/lib/auth/cookie';

export const POST = async (req: Request) => {
  if (!getAuthEnabled()) {
    return Response.json(
      { error: 'Authentication is not enabled' },
      { status: 404 },
    );
  }

  try {
    const { username, password } = await req.json();

    if (!username || !password) {
      return Response.json(
        { error: 'Username and password are required' },
        { status: 400 },
      );
    }

    const user = await getUserByUsername(username);

    if (!user) {
      return Response.json(
        { error: 'Invalid username or password' },
        { status: 401 },
      );
    }

    const valid = await verifyPassword(password, user.passwordHash);

    if (!valid) {
      return Response.json(
        { error: 'Invalid username or password' },
        { status: 401 },
      );
    }

    const { sessionId, expiresAt } = createSession(user.id);

    const cookie = await signSessionCookie({
      userId: user.id,
      sessionId,
      exp: expiresAt.getTime(),
    });

    const response = Response.json(
      {
        user: {
          id: user.id,
          username: user.username,
          role: user.role,
        },
      },
      { status: 200 },
    );

    // Set HttpOnly cookie
    response.headers.set(
      'Set-Cookie',
      `session_id=${cookie}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${7 * 24 * 60 * 60}${process.env.NODE_ENV === 'production' ? '; Secure' : ''}`,
    );

    return response;
  } catch (error) {
    console.error('Login error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
};
