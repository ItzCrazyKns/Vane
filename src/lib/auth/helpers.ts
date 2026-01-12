import { headers } from 'next/headers';
import type { AuthUser } from './types';

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
 * Get the authenticated user or throw an error.
 * Use this in API routes that require authentication.
 */
export async function requireUser(): Promise<AuthUser> {
  const user = await getRequestUser();

  if (!user) {
    throw new Error('Unauthorized');
  }

  return user;
}

/**
 * Get the authenticated admin user or throw an error.
 * Use this in API routes that require admin access.
 */
export async function requireAdmin(): Promise<AuthUser> {
  const user = await requireUser();

  if (user.role !== 'admin') {
    throw new Error('Forbidden: Admin access required');
  }

  return user;
}
