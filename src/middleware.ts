import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { jwtVerify } from 'jose';
import {
  AUTH_COOKIE_NAME,
  PUBLIC_API_ROUTES,
  PUBLIC_PAGES,
  SKIP_PATHS,
  getJwtSecret,
} from '@/lib/auth/constants';

const JWT_SECRET = getJwtSecret();

/**
 * Validate JWT payload has correct types and values.
 * Returns validated user object or null if invalid.
 */
function validateJwtPayload(
  payload: unknown,
): { userId: string; email: string; role: 'user' | 'admin' } | null {
  if (typeof payload !== 'object' || payload === null) {
    return null;
  }

  const p = payload as Record<string, unknown>;

  // Validate userId is a non-empty string
  if (typeof p.userId !== 'string' || p.userId.length === 0) {
    return null;
  }

  // Validate email is a non-empty string
  if (typeof p.email !== 'string' || p.email.length === 0) {
    return null;
  }

  // Validate role is exactly 'user' or 'admin'
  if (p.role !== 'user' && p.role !== 'admin') {
    return null;
  }

  return {
    userId: p.userId,
    email: p.email,
    role: p.role,
  };
}

async function verifyTokenFromRequest(
  request: NextRequest,
): Promise<{ userId: string; email: string; role: 'user' | 'admin' } | null> {
  const token = request.cookies.get(AUTH_COOKIE_NAME)?.value;

  if (!token) {
    return null;
  }

  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    return validateJwtPayload(payload);
  } catch {
    return null;
  }
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Skip static assets and Next.js internals
  if (SKIP_PATHS.some((path) => pathname.startsWith(path))) {
    return NextResponse.next();
  }

  // Allow public API routes (but still set headers if user is authenticated)
  if (PUBLIC_API_ROUTES.some((route) => pathname.startsWith(route))) {
    const user = await verifyTokenFromRequest(request);
    if (user) {
      // User is authenticated - add headers so route handlers can use them
      const requestHeaders = new Headers(request.headers);
      requestHeaders.set('x-user-id', user.userId);
      requestHeaders.set('x-user-email', user.email);
      requestHeaders.set('x-user-role', user.role);
      return NextResponse.next({
        request: { headers: requestHeaders },
      });
    }
    // Not authenticated - allow anyway (public route)
    return NextResponse.next();
  }

  // Allow public pages
  if (PUBLIC_PAGES.includes(pathname)) {
    // If user is already logged in, redirect to home
    const user = await verifyTokenFromRequest(request);
    if (user) {
      return NextResponse.redirect(new URL('/', request.url));
    }
    return NextResponse.next();
  }

  // Verify authentication for all other routes (including root path)
  const user = await verifyTokenFromRequest(request);

  if (!user) {
    // API routes return 401
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }
    // Pages redirect to login
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // Add user info to request headers for API routes
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-user-id', user.userId);
  requestHeaders.set('x-user-email', user.email);
  requestHeaders.set('x-user-role', user.role);

  return NextResponse.next({
    request: { headers: requestHeaders },
  });
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    '/((?!_next/static|_next/image|favicon.ico|public).*)',
  ],
};
