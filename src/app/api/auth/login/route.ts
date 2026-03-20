import {
  getUserByUsername,
  verifyPassword,
  createSession,
  getAuthEnabled,
} from '@/lib/auth';
import { signSessionCookie, formatCookieHeader } from '@/lib/auth/cookie';

// Simple in-memory rate limiter: 5 attempts per IP per 15 minutes
const loginAttempts = new Map<string, { count: number; resetAt: number }>();
const MAX_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000;

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = loginAttempts.get(ip);

  if (!entry || now > entry.resetAt) {
    loginAttempts.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return false;
  }

  entry.count++;
  return entry.count > MAX_ATTEMPTS;
}

// Clean up expired entries every 30 minutes to prevent unbounded growth
if (
  typeof globalThis !== 'undefined' &&
  !(globalThis as any)._loginRateLimitCleanup
) {
  (globalThis as any)._loginRateLimitCleanup = setInterval(() => {
    const now = Date.now();
    for (const [ip, entry] of loginAttempts) {
      if (now > entry.resetAt) loginAttempts.delete(ip);
    }
  }, 30 * 60 * 1000);
}

export const POST = async (req: Request) => {
  if (!getAuthEnabled()) {
    return Response.json(
      { error: 'Authentication is not enabled' },
      { status: 404 },
    );
  }

  try {
    const ip =
      req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      req.headers.get('x-real-ip') ||
      'unknown';

    if (isRateLimited(ip)) {
      return Response.json(
        { error: 'Too many login attempts. Please try again later.' },
        { status: 429 },
      );
    }

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

    response.headers.set('Set-Cookie', formatCookieHeader(cookie));

    return response;
  } catch (error) {
    console.error('Login error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
};
