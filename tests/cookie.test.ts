import { describe, it, expect } from 'vitest';
import {
  signSessionCookie,
  verifySessionCookie,
  formatCookieHeader,
} from '@/lib/auth/cookie';

describe('Cookie: signSessionCookie + verifySessionCookie', () => {
  const payload = {
    userId: 'user-123',
    sessionId: 'session-456',
    exp: Date.now() + 60_000, // 1 min from now
  };

  it('signs and verifies a valid cookie', async () => {
    const cookie = await signSessionCookie(payload);
    expect(cookie).toBeTruthy();
    expect(cookie).toContain('.');

    const verified = await verifySessionCookie(cookie);
    expect(verified).toMatchObject({
      userId: 'user-123',
      sessionId: 'session-456',
    });
  });

  it('rejects a tampered cookie', async () => {
    const cookie = await signSessionCookie(payload);
    // Flip a character in the signature
    const tampered = cookie.slice(0, -1) + (cookie.endsWith('a') ? 'b' : 'a');
    const result = await verifySessionCookie(tampered);
    expect(result).toBeNull();
  });

  it('rejects an expired cookie', async () => {
    const expiredPayload = { ...payload, exp: Date.now() - 1000 };
    const cookie = await signSessionCookie(expiredPayload);
    const result = await verifySessionCookie(cookie);
    expect(result).toBeNull();
  });

  it('rejects malformed cookies', async () => {
    expect(await verifySessionCookie('')).toBeNull();
    expect(await verifySessionCookie('nodot')).toBeNull();
    expect(await verifySessionCookie('a.b.c')).toBeNull();
    expect(await verifySessionCookie('...')).toBeNull();
  });

  it('round-trips all payload fields', async () => {
    const cookie = await signSessionCookie(payload);
    const verified = await verifySessionCookie(cookie);
    expect(verified!.userId).toBe(payload.userId);
    expect(verified!.sessionId).toBe(payload.sessionId);
    expect(verified!.exp).toBe(payload.exp);
  });
});

describe('Cookie: formatCookieHeader', () => {
  it('includes required flags', () => {
    const header = formatCookieHeader('test-cookie-value');
    expect(header).toContain('session_id=test-cookie-value');
    expect(header).toContain('Path=/');
    expect(header).toContain('HttpOnly');
    expect(header).toContain('SameSite=Strict');
    expect(header).toContain('Max-Age=604800');
  });

  it('does not include Secure by default', () => {
    const header = formatCookieHeader('test-cookie-value');
    expect(header).not.toContain('Secure');
  });

  it('includes Secure when SECURE_COOKIES=true', () => {
    const original = process.env.SECURE_COOKIES;
    process.env.SECURE_COOKIES = 'true';
    const header = formatCookieHeader('test-cookie-value');
    expect(header).toContain('; Secure');
    process.env.SECURE_COOKIES = original;
  });
});
