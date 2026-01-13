import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { jwtVerify } from 'jose';

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'perplexica-default-secret-change-in-production',
);

const AUTH_COOKIE_NAME = 'auth-token';

// Routes that don't require authentication (before login)
const publicApiRoutes = [
  '/api/auth/login',
  '/api/auth/register',
  '/api/auth/logout',
  '/api/config',
  '/api/providers',
  '/api/models',
];

// Note: Root path (/) is allowed during setup wizard (before auth is configured)
const publicPages = ['/login', '/register'];

// Static assets and Next.js internals to skip
const skipPaths = ['/_next', '/favicon.ico', '/public'];

async function verifyTokenFromRequest(
  request: NextRequest,
): Promise<{ userId: string; email: string; role: string } | null> {
  const token = request.cookies.get(AUTH_COOKIE_NAME)?.value;

  if (!token) {
    return null;
  }

  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    const { userId, email, role } = payload as {
      userId: string;
      email: string;
      role: string;
    };

    if (!userId || !email || !role) {
      return null;
    }

    return { userId, email, role };
  } catch {
    return null;
  }
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Skip static assets and Next.js internals
  if (skipPaths.some((path) => pathname.startsWith(path))) {
    return NextResponse.next();
  }

  // Allow public API routes
  if (publicApiRoutes.some((route) => pathname.startsWith(route))) {
    return NextResponse.next();
  }

  // Allow public pages
  if (publicPages.includes(pathname)) {
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
