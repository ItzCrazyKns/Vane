import { NextRequest, NextResponse } from 'next/server';
import { verifySessionCookie } from '@/lib/auth/cookie';

export async function middleware(request: NextRequest) {
  const authEnabled = process.env.AUTH_ENABLED === 'true';

  if (!authEnabled) {
    return NextResponse.next();
  }

  const cookie = request.cookies.get('session_id')?.value;

  if (!cookie) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  const payload = await verifySessionCookie(cookie);

  if (!payload) {
    const response = NextResponse.redirect(new URL('/login', request.url));
    response.cookies.delete('session_id');
    return response;
  }

  // Pass userId to downstream route handlers via header
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-user-id', payload.userId);

  return NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });
}

export const config = {
  matcher: [
    '/((?!login|api/auth|_next/static|_next/image|favicon\\.ico|manifest\\.webmanifest|.*\\.png$|.*\\.svg$).*)',
  ],
};
