import { SignJWT, jwtVerify } from 'jose';
import bcrypt from 'bcryptjs';
import { cookies } from 'next/headers';
import type { JWTPayload, AuthUser } from './types';

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'perplexica-default-secret-change-in-production',
);
const TOKEN_EXPIRY = '7d';
const BCRYPT_ROUNDS = 12;

export const AUTH_COOKIE_NAME = 'auth-token';

/**
 * Hash a password using bcrypt.
 */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

/**
 * Verify a password against a bcrypt hash.
 */
export async function verifyPassword(
  password: string,
  hash: string,
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

/**
 * Create a JWT token for the given user.
 */
export async function createToken(
  userId: string,
  email: string,
  role: 'user' | 'admin',
): Promise<string> {
  return new SignJWT({ userId, email, role })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(TOKEN_EXPIRY)
    .sign(JWT_SECRET);
}

/**
 * Verify and decode a JWT token.
 * Returns null if the token is invalid or expired.
 */
export async function verifyToken(token: string): Promise<AuthUser | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    const jwtPayload = payload as unknown as JWTPayload;

    if (!jwtPayload.userId || !jwtPayload.email || !jwtPayload.role) {
      return null;
    }

    return {
      userId: jwtPayload.userId,
      email: jwtPayload.email,
      role: jwtPayload.role,
    };
  } catch {
    return null;
  }
}

/**
 * Get the current user from the auth cookie.
 * For use in server components and API routes.
 */
export async function getCurrentUser(): Promise<AuthUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(AUTH_COOKIE_NAME)?.value;

  if (!token) {
    return null;
  }

  return verifyToken(token);
}

/**
 * Set the auth cookie with the given token.
 */
export async function setAuthCookie(token: string): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(AUTH_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7, // 7 days
    path: '/',
  });
}

/**
 * Clear the auth cookie.
 */
export async function clearAuthCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(AUTH_COOKIE_NAME);
}
