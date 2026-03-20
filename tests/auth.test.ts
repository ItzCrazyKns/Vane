import { describe, it, expect, beforeEach } from 'vitest';
import { sqlite } from './setup';
import {
  createUser,
  createSession,
  hasAnyUsers,
  getUserByUsername,
  getUserById,
  getAllUsers,
  deleteUserById,
  resetPasswordById,
  verifyPassword,
  isAdmin,
  getAuthEnabled,
} from '@/lib/auth';

function clearTables() {
  sqlite.exec('DELETE FROM messages');
  sqlite.exec('DELETE FROM chats');
  sqlite.exec('DELETE FROM sessions');
  sqlite.exec('DELETE FROM users');
}

describe('Auth: getAuthEnabled', () => {
  it('returns true by default', () => {
    expect(getAuthEnabled()).toBe(true);
  });

  it('returns false when AUTH_ENABLED=false', () => {
    const original = process.env.AUTH_ENABLED;
    process.env.AUTH_ENABLED = 'false';
    expect(getAuthEnabled()).toBe(false);
    process.env.AUTH_ENABLED = original;
  });
});

describe('Auth: user creation', () => {
  beforeEach(clearTables);

  it('hasAnyUsers returns false when no users', async () => {
    expect(await hasAnyUsers()).toBe(false);
  });

  it('createUser creates an admin user', async () => {
    const user = await createUser('admin', 'password123', 'admin');
    expect(user).toMatchObject({
      username: 'admin',
      role: 'admin',
    });
    expect(user.id).toBeTruthy();
    expect(user.createdAt).toBeTruthy();
    // Should not contain passwordHash
    expect((user as any).passwordHash).toBeUndefined();
  });

  it('hasAnyUsers returns true after creating a user', async () => {
    await createUser('admin', 'password123', 'admin');
    expect(await hasAnyUsers()).toBe(true);
  });

  it('createUser hashes the password', async () => {
    const user = await createUser('admin', 'password123', 'admin');
    const dbUser = await getUserById(user.id);
    expect(dbUser).toBeTruthy();
    expect(dbUser!.passwordHash).not.toBe('password123');
    expect(await verifyPassword('password123', dbUser!.passwordHash)).toBe(
      true,
    );
    expect(await verifyPassword('wrongpassword', dbUser!.passwordHash)).toBe(
      false,
    );
  });

  it('rejects duplicate usernames', async () => {
    await createUser('admin', 'password123', 'admin');
    await expect(
      createUser('admin', 'otherpassword', 'user'),
    ).rejects.toThrow();
  });

  it('creates a regular user', async () => {
    const user = await createUser('regularuser', 'password123', 'user');
    expect(user.role).toBe('user');
  });
});

describe('Auth: user lookup', () => {
  beforeEach(clearTables);

  it('getUserByUsername finds existing user', async () => {
    await createUser('admin', 'password123', 'admin');
    const found = await getUserByUsername('admin');
    expect(found).toBeTruthy();
    expect(found!.username).toBe('admin');
  });

  it('getUserByUsername returns undefined for missing user', async () => {
    const found = await getUserByUsername('nonexistent');
    expect(found).toBeUndefined();
  });

  it('getUserById finds existing user', async () => {
    const created = await createUser('admin', 'password123', 'admin');
    const found = await getUserById(created.id);
    expect(found).toBeTruthy();
    expect(found!.id).toBe(created.id);
  });

  it('getAllUsers returns all users without passwordHash', async () => {
    await createUser('admin', 'password123', 'admin');
    await createUser('user1', 'password123', 'user');
    const all = await getAllUsers();
    expect(all).toHaveLength(2);
    all.forEach((u) => {
      expect((u as any).passwordHash).toBeUndefined();
    });
  });
});

describe('Auth: isAdmin', () => {
  beforeEach(clearTables);

  it('returns true for admin user', async () => {
    const user = await createUser('admin', 'password123', 'admin');
    expect(await isAdmin(user.id)).toBe(true);
  });

  it('returns false for regular user', async () => {
    const user = await createUser('user1', 'password123', 'user');
    expect(await isAdmin(user.id)).toBe(false);
  });

  it('returns false for nonexistent user', async () => {
    expect(await isAdmin('nonexistent-id')).toBe(false);
  });
});

describe('Auth: sessions', () => {
  beforeEach(clearTables);

  it('createSession returns sessionId and expiresAt', async () => {
    const user = await createUser('admin', 'password123', 'admin');
    const session = createSession(user.id);
    expect(session.sessionId).toBeTruthy();
    expect(session.expiresAt).toBeInstanceOf(Date);
    expect(session.expiresAt.getTime()).toBeGreaterThan(Date.now());
  });

  it('session is persisted in the database', async () => {
    const user = await createUser('admin', 'password123', 'admin');
    const { sessionId } = createSession(user.id);
    const row = sqlite
      .prepare('SELECT * FROM sessions WHERE id = ?')
      .get(sessionId) as any;
    expect(row).toBeTruthy();
    expect(row.userId).toBe(user.id);
  });
});

describe('Auth: deleteUserById', () => {
  beforeEach(clearTables);

  it('deletes user, sessions, chats, and messages', async () => {
    const user = await createUser('admin', 'password123', 'admin');
    createSession(user.id);

    // Insert a chat and message for this user
    sqlite
      .prepare(
        "INSERT INTO chats (id, title, createdAt, userId) VALUES ('c1', 'Test Chat', '2024-01-01', ?)",
      )
      .run(user.id);
    sqlite
      .prepare(
        "INSERT INTO messages (messageId, chatId, backendId, query, createdAt) VALUES ('m1', 'c1', 'b1', 'test query', '2024-01-01')",
      )
      .run();

    await deleteUserById(user.id);

    expect(await getUserById(user.id)).toBeUndefined();
    const sessCount = sqlite
      .prepare('SELECT COUNT(*) as c FROM sessions WHERE userId = ?')
      .get(user.id) as any;
    expect(sessCount.c).toBe(0);
    const chatCount = sqlite
      .prepare('SELECT COUNT(*) as c FROM chats WHERE userId = ?')
      .get(user.id) as any;
    expect(chatCount.c).toBe(0);
    const msgCount = sqlite
      .prepare("SELECT COUNT(*) as c FROM messages WHERE chatId = 'c1'")
      .get() as any;
    expect(msgCount.c).toBe(0);
  });
});

describe('Auth: resetPasswordById', () => {
  beforeEach(clearTables);

  it('updates password and revokes sessions', async () => {
    const user = await createUser('admin', 'password123', 'admin');
    createSession(user.id);

    await resetPasswordById(user.id, 'newpassword456');

    const dbUser = await getUserById(user.id);
    expect(await verifyPassword('newpassword456', dbUser!.passwordHash)).toBe(
      true,
    );
    expect(await verifyPassword('password123', dbUser!.passwordHash)).toBe(
      false,
    );

    // Sessions should be cleared
    const sessCount = sqlite
      .prepare('SELECT COUNT(*) as c FROM sessions WHERE userId = ?')
      .get(user.id) as any;
    expect(sessCount.c).toBe(0);
  });

  it('throws for nonexistent user', async () => {
    await expect(
      resetPasswordById('nonexistent', 'newpassword'),
    ).rejects.toThrow('User not found');
  });
});
