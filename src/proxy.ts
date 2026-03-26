import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const ADMIN_ROUTES = ['/api/config', '/api/providers'];

function isAdminRoute(pathname: string): boolean {
  return ADMIN_ROUTES.some((route) => pathname.startsWith(route));
}

export function proxy(request: NextRequest) {
  if (!isAdminRoute(request.nextUrl.pathname)) {
    return NextResponse.next();
  }

  const adminSecret = process.env.ADMIN_SECRET;

  if (!adminSecret) {
    return NextResponse.next();
  }

  const authHeader = request.headers.get('authorization');
  const bearerToken = authHeader?.startsWith('Bearer ')
    ? authHeader.slice(7)
    : null;

  const cookieToken = request.cookies.get('vane-admin-token')?.value;

  if (bearerToken === adminSecret || cookieToken === adminSecret) {
    return NextResponse.next();
  }

  return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
}

export const config = {
  matcher: ['/api/config/:path*', '/api/providers/:path*'],
};
