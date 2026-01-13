/**
 * Shared authentication constants.
 * Used by both middleware (Edge runtime) and auth library (Node.js runtime).
 */

export const AUTH_COOKIE_NAME = 'auth-token';

/**
 * Token expiry configuration.
 *
 * Current strategy: 7-day tokens without refresh mechanism.
 * Trade-off: Simpler implementation with acceptable security for most use cases.
 *
 * For higher-security deployments, consider:
 * - Reducing to 1-hour tokens with refresh token rotation
 * - Adding server-side session invalidation
 * - Implementing sliding window expiry
 */
export const TOKEN_EXPIRY = '7d';
export const TOKEN_MAX_AGE_SECONDS = 60 * 60 * 24 * 7; // 7 days

// Development fallback secret - only used when JWT_SECRET env var is not set
export const DEV_JWT_SECRET = 'perplexica-dev-secret-do-not-use-in-production';

// Public routes that don't require authentication
export const PUBLIC_API_ROUTES = [
  '/api/auth/login',
  '/api/auth/register',
  '/api/auth/logout',
  '/api/config',
  '/api/providers',
  '/api/models',
];

export const PUBLIC_PAGES = ['/login', '/register'];

export const SKIP_PATHS = ['/_next', '/favicon.ico', '/public'];

/**
 * Get the JWT secret, with validation for production.
 * Throws an error if JWT_SECRET is not set in production.
 */
export function getJwtSecret(): Uint8Array {
  const JWT_SECRET_RAW = process.env.JWT_SECRET;

  if (!JWT_SECRET_RAW && process.env.NODE_ENV === 'production') {
    throw new Error(
      'CRITICAL: JWT_SECRET environment variable is required in production. ' +
        "Generate one with: node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\"",
    );
  }

  if (!JWT_SECRET_RAW) {
    console.warn(
      '[AUTH] WARNING: JWT_SECRET not set. Using insecure default for development only.',
    );
  }

  return new TextEncoder().encode(JWT_SECRET_RAW || DEV_JWT_SECRET);
}
