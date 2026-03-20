import { NextRequest, NextResponse } from 'next/server';
import { verifySessionCookie } from '@/lib/auth/cookie';

export async function middleware(request: NextRequest) {
  // Auth is enabled by default. Set AUTH_ENABLED=false to disable.
  const authEnabled = process.env.AUTH_ENABLED !== 'false';

  if (!authEnabled) {
    return NextResponse.next();
  }

  const cookie = request.cookies.get('session_id')?.value;
  const isApiRoute = request.nextUrl.pathname.startsWith('/api/');

  if (!cookie) {
    // API routes: pass through without user context — each route handles its own auth.
    // Redirecting API fetches to /login returns HTML, which breaks JSON clients.
    if (isApiRoute) return NextResponse.next();
    return NextResponse.redirect(new URL('/login', request.url));
  }

  const payload = await verifySessionCookie(cookie);

  if (!payload) {
    // API routes: pass through (let routes return 401/403 themselves)
    if (isApiRoute) {
      const response = NextResponse.next();
      response.cookies.delete('session_id');
      return response;
    }
    const response = NextResponse.redirect(new URL('/login', request.url));
    response.cookies.delete('session_id');
    return response;
  }

  // Pass userId and sessionId to downstream route handlers via headers.
  // Middleware validates cookie signature + expiry (fast, no DB).
  // API routes that need revocation support check sessionId against the DB.
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-user-id', payload.userId);
  requestHeaders.set('x-session-id', payload.sessionId);

  return NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });
}

export const config = {
  matcher: [
    '/((?!login|setup|api/auth|_next/static|_next/image|favicon\\.ico|manifest\\.webmanifest|.*\\.png$|.*\\.svg$).*)',
  ],
};
