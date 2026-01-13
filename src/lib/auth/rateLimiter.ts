/**
 * Simple in-memory rate limiter for authentication endpoints.
 * Tracks attempts by key (IP or email) and limits requests within a time window.
 */

interface RateLimitEntry {
  count: number;
  firstAttempt: number;
}

const store = new Map<string, RateLimitEntry>();

// Configuration
const MAX_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000; // Clean up every 5 minutes

// Periodic cleanup of expired entries
let cleanupScheduled = false;

function scheduleCleanup() {
  if (cleanupScheduled) return;
  cleanupScheduled = true;

  setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of store.entries()) {
      if (now - entry.firstAttempt > WINDOW_MS) {
        store.delete(key);
      }
    }
  }, CLEANUP_INTERVAL_MS);
}

/**
 * Check if a key is rate limited and record the attempt.
 * Returns { limited: false } if allowed, or { limited: true, retryAfter } if blocked.
 */
export function checkRateLimit(key: string): {
  limited: boolean;
  retryAfter?: number;
  remaining?: number;
} {
  scheduleCleanup();

  const now = Date.now();
  const entry = store.get(key);

  if (!entry) {
    // First attempt
    store.set(key, { count: 1, firstAttempt: now });
    return { limited: false, remaining: MAX_ATTEMPTS - 1 };
  }

  // Check if window has expired
  if (now - entry.firstAttempt > WINDOW_MS) {
    // Reset the window
    store.set(key, { count: 1, firstAttempt: now });
    return { limited: false, remaining: MAX_ATTEMPTS - 1 };
  }

  // Window still active
  if (entry.count >= MAX_ATTEMPTS) {
    const retryAfter = Math.ceil(
      (WINDOW_MS - (now - entry.firstAttempt)) / 1000,
    );
    return { limited: true, retryAfter };
  }

  // Increment count
  entry.count++;
  store.set(key, entry);
  return { limited: false, remaining: MAX_ATTEMPTS - entry.count };
}

/**
 * Reset rate limit for a key (e.g., after successful login).
 */
export function resetRateLimit(key: string): void {
  store.delete(key);
}

/**
 * Get client IP from Next.js request headers.
 * Checks x-forwarded-for for proxy setups.
 */
export function getClientIp(headers: Headers): string {
  const forwarded = headers.get('x-forwarded-for');
  if (forwarded) {
    // x-forwarded-for can contain multiple IPs, take the first one
    return forwarded.split(',')[0].trim();
  }
  return headers.get('x-real-ip') || 'unknown';
}
