/**
 * Integration tests for the first-run setup flow.
 * Tests the complete path: check setup status → create admin → auto-login cookie.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { sqlite } from './setup';
import { hasAnyUsers, getUserByUsername, verifyPassword } from '@/lib/auth';
import { verifySessionCookie } from '@/lib/auth/cookie';

// Import the route handlers directly
import { GET as setupGet, POST as setupPost } from '@/app/api/auth/setup/route';

function clearTables() {
  sqlite.exec('DELETE FROM messages');
  sqlite.exec('DELETE FROM chats');
  sqlite.exec('DELETE FROM sessions');
  sqlite.exec('DELETE FROM users');
}

function makeRequest(body?: object): Request {
  if (!body) {
    return new Request('http://localhost:3000/api/auth/setup', {
      method: 'GET',
    });
  }
  return new Request('http://localhost:3000/api/auth/setup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('Setup flow: GET /api/auth/setup', () => {
  beforeEach(clearTables);

  it('returns needsSetup=true when no users exist', async () => {
    const res = await setupGet();
    const data = await res.json();
    expect(data.needsSetup).toBe(true);
  });

  it('returns needsSetup=false when users exist', async () => {
    const { createUser } = await import('@/lib/auth');
    await createUser('admin', 'password123', 'admin');
    const res = await setupGet();
    const data = await res.json();
    expect(data.needsSetup).toBe(false);
  });
});

describe('Setup flow: POST /api/auth/setup', () => {
  beforeEach(clearTables);

  it('creates admin user with valid credentials', async () => {
    const res = await setupPost(
      makeRequest({ username: 'admin', password: 'password123' }),
    );
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.user.username).toBe('admin');
    expect(data.user.role).toBe('admin');
  });

  it('stores hashed password in database', async () => {
    await setupPost(
      makeRequest({ username: 'admin', password: 'password123' }),
    );
    const user = await getUserByUsername('admin');
    expect(user).toBeTruthy();
    expect(user!.passwordHash).not.toBe('password123');
    expect(await verifyPassword('password123', user!.passwordHash)).toBe(true);
  });

  it('returns a valid session cookie (auto-login)', async () => {
    const res = await setupPost(
      makeRequest({ username: 'admin', password: 'password123' }),
    );
    const setCookie = res.headers.get('set-cookie');
    expect(setCookie).toBeTruthy();
    expect(setCookie).toContain('session_id=');
    expect(setCookie).toContain('HttpOnly');
    expect(setCookie).toContain('SameSite=Strict');

    // Extract cookie value and verify it
    const match = setCookie!.match(/session_id=([^;]+)/);
    expect(match).toBeTruthy();
    const payload = await verifySessionCookie(match![1]);
    expect(payload).toBeTruthy();
    expect(payload!.userId).toBeTruthy();
    expect(payload!.sessionId).toBeTruthy();
    expect(payload!.exp).toBeGreaterThan(Date.now());
  });

  it('creates a session record in the database', async () => {
    const res = await setupPost(
      makeRequest({ username: 'admin', password: 'password123' }),
    );
    const data = await res.json();
    const sessions = sqlite
      .prepare('SELECT * FROM sessions WHERE userId = ?')
      .all(data.user.id) as any[];
    expect(sessions.length).toBe(1);
    expect(new Date(sessions[0].expiresAt).getTime()).toBeGreaterThan(
      Date.now(),
    );
  });

  it('rejects setup when users already exist', async () => {
    const { createUser } = await import('@/lib/auth');
    await createUser('admin', 'password123', 'admin');

    const res = await setupPost(
      makeRequest({ username: 'admin2', password: 'password123' }),
    );
    expect(res.status).toBe(403);
    const data = await res.json();
    expect(data.message).toContain('already exists');
  });

  it('rejects missing username', async () => {
    const res = await setupPost(makeRequest({ password: 'password123' }));
    expect(res.status).toBe(400);
  });

  it('rejects missing password', async () => {
    const res = await setupPost(makeRequest({ username: 'admin' }));
    expect(res.status).toBe(400);
  });

  it('rejects password shorter than 8 characters', async () => {
    const res = await setupPost(
      makeRequest({ username: 'admin', password: 'short' }),
    );
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.message).toContain('8 characters');
  });
});

describe('Setup flow: end-to-end first-run', () => {
  beforeEach(clearTables);

  it('completes the full first-run flow', async () => {
    // Step 1: Check if setup is needed
    const checkRes = await setupGet();
    const checkData = await checkRes.json();
    expect(checkData.needsSetup).toBe(true);

    // Step 2: Create admin account
    const createRes = await setupPost(
      makeRequest({ username: 'myadmin', password: 'securepass123' }),
    );
    expect(createRes.status).toBe(201);
    const createData = await createRes.json();
    expect(createData.user.role).toBe('admin');

    // Step 3: Verify auto-login cookie is valid
    const setCookie = createRes.headers.get('set-cookie')!;
    const cookieMatch = setCookie.match(/session_id=([^;]+)/)!;
    const payload = await verifySessionCookie(cookieMatch[1]);
    expect(payload).toBeTruthy();
    expect(payload!.userId).toBe(createData.user.id);

    // Step 4: Verify setup is no longer needed
    const recheckRes = await setupGet();
    const recheckData = await recheckRes.json();
    expect(recheckData.needsSetup).toBe(false);

    // Step 5: Verify can't create another admin
    const dupeRes = await setupPost(
      makeRequest({ username: 'admin2', password: 'password123' }),
    );
    expect(dupeRes.status).toBe(403);

    // Step 6: Verify user is in database
    expect(await hasAnyUsers()).toBe(true);
    const admin = await getUserByUsername('myadmin');
    expect(admin).toBeTruthy();
    expect(admin!.role).toBe('admin');
  });
});
