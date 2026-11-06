import { NextRequest, NextResponse } from 'next/server';
import { checkApiRequest } from '@/lib/security/requestGuard';

/* Blocks DNS rebinding and cross-site writes to the API (see requestGuard). */
export function proxy(request: NextRequest) {
  const blocked = checkApiRequest({
    method: request.method,
    host: request.headers.get('host'),
    forwardedHost: request.headers.get('x-forwarded-host'),
    origin: request.headers.get('origin'),
    secFetchSite: request.headers.get('sec-fetch-site'),
    allowedHosts: process.env.VANE_ALLOWED_HOSTS,
  });

  if (blocked) {
    return NextResponse.json(
      { message: blocked.message },
      { status: blocked.status },
    );
  }

  return NextResponse.next();
}

export const config = {
  matcher: '/api/:path*',
};
