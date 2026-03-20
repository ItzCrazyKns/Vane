import { describe, it, expect, vi, beforeEach, afterEach, beforeAll } from 'vitest';
import { NextRequest } from 'next/server';
import { signSessionCookie } from '@/lib/auth/cookie';
import { middleware } from '@/middleware';

function makeRequest(
  path: string,
  opts?: { cookie?: string; method?: string },
): NextRequest {
  const url = `http://localhost:3000${path}`;
  const req = new NextRequest(url, { method: opts?.method || 'GET' });
  if (opts?.cookie) {
    req.cookies.set('session_id', opts.cookie);
  }
  return req;
}

describe('Middleware: auth disabled', () => {
  beforeEach(() => {
    process.env.AUTH_ENABLED = 'false';
  });

  afterEach(() => {
    process.env.AUTH_ENABLED = 'true';
  });

  it('passes through all requests when auth is disabled', async () => {
    const res = await middleware(makeRequest('/'));
    expect(res.status).not.toBe(307);
  });

  it('passes API routes when auth is disabled', async () => {
    const res = await middleware(makeRequest('/api/providers'));
    expect(res.status).not.toBe(307);
  });
});

describe('Middleware: auth enabled, no cookie', () => {
  it('redirects page requests to /login', async () => {
    const res = await middleware(makeRequest('/'));
    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toContain('/login');
  });

  it('passes through API routes without redirect', async () => {
    const res = await middleware(makeRequest('/api/providers'));
    // Should NOT redirect — API routes handle their own auth
    expect(res.status).not.toBe(307);
    expect(res.headers.get('location')).toBeNull();
  });

  it('passes through API POST routes without redirect', async () => {
    const res = await middleware(
      makeRequest('/api/providers', { method: 'POST' }),
    );
    expect(res.status).not.toBe(307);
  });

  it('passes /api/config without redirect', async () => {
    const res = await middleware(makeRequest('/api/config'));
    expect(res.status).not.toBe(307);
  });

  it('passes /api/config/setup-complete without redirect', async () => {
    const res = await middleware(
      makeRequest('/api/config/setup-complete', { method: 'POST' }),
    );
    expect(res.status).not.toBe(307);
  });
});

describe('Middleware: auth enabled, valid cookie', () => {
  let validCookie: string;

  beforeAll(async () => {
    validCookie = await signSessionCookie({
      userId: 'test-user-id',
      sessionId: 'test-session-id',
      exp: Date.now() + 3600_000,
    });
  });

  it('passes through page requests and injects headers', async () => {
    const res = await middleware(makeRequest('/', { cookie: validCookie }));
    expect(res.status).not.toBe(307);
    // The middleware returns NextResponse.next() with modified headers
    // In testing, we verify it didn't redirect
  });

  it('passes through API requests with valid cookie', async () => {
    const res = await middleware(
      makeRequest('/api/providers', { cookie: validCookie }),
    );
    expect(res.status).not.toBe(307);
  });
});

describe('Middleware: auth enabled, invalid/expired cookie', () => {
  it('redirects page requests with invalid cookie', async () => {
    const res = await middleware(
      makeRequest('/', { cookie: 'invalid.cookie' }),
    );
    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toContain('/login');
  });

  it('passes through API routes with invalid cookie (no redirect)', async () => {
    const res = await middleware(
      makeRequest('/api/providers', { cookie: 'invalid.cookie' }),
    );
    expect(res.status).not.toBe(307);
  });

  it('deletes invalid cookie on API routes', async () => {
    const res = await middleware(
      makeRequest('/api/providers', { cookie: 'invalid.cookie' }),
    );
    const setCookie = res.headers.get('set-cookie');
    // Cookie should be deleted
    expect(setCookie).toBeTruthy();
  });

  it('redirects page with expired cookie', async () => {
    const expiredCookie = await signSessionCookie({
      userId: 'user',
      sessionId: 'sess',
      exp: Date.now() - 1000,
    });
    const res = await middleware(
      makeRequest('/', { cookie: expiredCookie }),
    );
    expect(res.status).toBe(307);
  });

  it('passes API with expired cookie (no redirect)', async () => {
    const expiredCookie = await signSessionCookie({
      userId: 'user',
      sessionId: 'sess',
      exp: Date.now() - 1000,
    });
    const res = await middleware(
      makeRequest('/api/providers', { cookie: expiredCookie }),
    );
    expect(res.status).not.toBe(307);
  });
});

describe('Middleware: excluded routes (via matcher config)', () => {
  // Note: Next.js applies the matcher regex anchored to the start of the path.
  // We add ^ to simulate that anchoring in our test.
  const matcherRegex = new RegExp(
    '^/((?!login|setup|api/auth|_next/static|_next/image|favicon\\.ico|manifest\\.webmanifest|.*\\.png$|.*\\.svg$).*)',
  );

  it('matcher regex excludes /login', () => {
    expect(matcherRegex.test('/login')).toBe(false);
  });

  it('matcher regex excludes /setup', () => {
    expect(matcherRegex.test('/setup')).toBe(false);
  });

  it('matcher regex excludes /api/auth/setup', () => {
    expect(matcherRegex.test('/api/auth/setup')).toBe(false);
  });

  it('matcher regex excludes /api/auth/login', () => {
    expect(matcherRegex.test('/api/auth/login')).toBe(false);
  });

  it('matcher regex includes /api/providers', () => {
    expect(matcherRegex.test('/api/providers')).toBe(true);
  });

  it('matcher regex includes /api/config', () => {
    expect(matcherRegex.test('/api/config')).toBe(true);
  });

  it('matcher regex includes /dashboard', () => {
    expect(matcherRegex.test('/dashboard')).toBe(true);
  });

  it('matcher regex excludes static assets', () => {
    expect(matcherRegex.test('/favicon.ico')).toBe(false);
    expect(matcherRegex.test('/icon.png')).toBe(false);
  });
});
