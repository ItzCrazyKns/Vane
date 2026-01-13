import { headers } from 'next/headers';
import type { AuthUser } from './types';

/**
 * Custom error class for authentication/authorization failures.
 * Includes HTTP status code for proper error responses.
 */
export class AuthError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'AuthError';
    this.status = status;
  }
}

/**
 * Check if an error is an AuthError.
 */
export function isAuthError(error: unknown): error is AuthError {
  return error instanceof AuthError;
}

/**
 * Get the authenticated user from request headers.
 * Headers are set by middleware after token verification.
 */
export async function getRequestUser(): Promise<AuthUser | null> {
  const headersList = await headers();
  const userId = headersList.get('x-user-id');
  const email = headersList.get('x-user-email');
  const role = headersList.get('x-user-role') as 'user' | 'admin' | null;

  if (!userId || !email || !role) {
    return null;
  }

  return { userId, email, role };
}

/**
 * Get the authenticated user or throw an AuthError.
 * Use this in API routes that require authentication.
 */
export async function requireUser(): Promise<AuthUser> {
  const user = await getRequestUser();

  if (!user) {
    throw new AuthError('Authentication required', 401);
  }

  return user;
}

/**
 * Get the authenticated admin user or throw an AuthError.
 * Use this in API routes that require admin access.
 */
export async function requireAdmin(): Promise<AuthUser> {
  const user = await requireUser();

  if (user.role !== 'admin') {
    throw new AuthError('Admin access required', 403);
  }

  return user;
}
