/**
 * HMAC-signed session cookie utilities.
 *
 * Uses Web Crypto API so it works in both Node.js and Edge Runtime
 * (Next.js middleware runs in Edge, which can't use better-sqlite3).
 *
 * Cookie format: base64(payload).signature
 * Payload: { userId, sessionId, exp }
 */

interface SessionPayload {
  userId: string;
  sessionId: string;
  exp: number; // Unix timestamp (ms)
}

function getSecret(): string {
  if (process.env.SESSION_SECRET) {
    return process.env.SESSION_SECRET;
  }

  // Auto-generate and persist a session secret if not provided
  const path = require('path');
  const fs = require('fs');
  const secretPath = path.join(
    process.env.DATA_DIR || process.cwd(),
    'data',
    'session.secret',
  );

  try {
    if (fs.existsSync(secretPath)) {
      return fs.readFileSync(secretPath, 'utf-8').trim();
    }
  } catch {
    // Fall through to generate
  }

  const generated = require('crypto').randomBytes(32).toString('hex');
  try {
    fs.mkdirSync(path.dirname(secretPath), { recursive: true });
    fs.writeFileSync(secretPath, generated, { mode: 0o600 });
  } catch (err) {
    console.warn('Could not persist session secret:', err);
  }
  return generated;
}

async function getKey(): Promise<CryptoKey> {
  const secret = getSecret();
  const enc = new TextEncoder();
  return crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify'],
  );
}

function toBase64(str: string): string {
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(str).toString('base64url');
  }
  // Edge Runtime fallback
  const bytes = new TextEncoder().encode(str);
  let binary = '';
  for (const b of bytes) {
    binary += String.fromCharCode(b);
  }
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function fromBase64(b64: string): string {
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(b64, 'base64url').toString('utf-8');
  }
  // Edge Runtime fallback
  const padded = b64.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new TextDecoder().decode(bytes);
}

function bufToHex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export async function signSessionCookie(
  payload: SessionPayload,
): Promise<string> {
  const key = await getKey();
  const data = toBase64(JSON.stringify(payload));
  const sig = await crypto.subtle.sign(
    'HMAC',
    key,
    new TextEncoder().encode(data),
  );
  return `${data}.${bufToHex(sig)}`;
}

/**
 * Build the Set-Cookie header value for a signed session cookie.
 * Secure flag is only added when SECURE_COOKIES=true (e.g. behind HTTPS proxy).
 * Self-hosted HTTP deployments (Unraid, LAN) must NOT use Secure or the
 * browser will refuse to store/send the cookie.
 */
export function formatCookieHeader(cookie: string): string {
  const secure = process.env.SECURE_COOKIES === 'true' ? '; Secure' : '';
  return `session_id=${cookie}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${7 * 24 * 60 * 60}${secure}`;
}

export async function verifySessionCookie(
  cookie: string,
): Promise<SessionPayload | null> {
  try {
    const [data, sig] = cookie.split('.');
    if (!data || !sig) return null;

    const key = await getKey();
    const sigBytes = new Uint8Array(
      sig.match(/.{2}/g)!.map((h) => parseInt(h, 16)),
    );
    const valid = await crypto.subtle.verify(
      'HMAC',
      key,
      sigBytes,
      new TextEncoder().encode(data),
    );

    if (!valid) return null;

    const payload: SessionPayload = JSON.parse(fromBase64(data));

    // Check expiry
    if (payload.exp < Date.now()) return null;

    return payload;
  } catch {
    return null;
  }
}
