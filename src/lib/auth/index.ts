import bcrypt from 'bcryptjs';
import db from '@/lib/db';
import { users, sessions, chats, messages } from '@/lib/db/schema';
import { eq, lt } from 'drizzle-orm';

const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export function getAuthEnabled(): boolean {
  // Auth is enabled by default. Set AUTH_ENABLED=false to disable.
  return process.env.AUTH_ENABLED !== 'false';
}

export async function hasAnyUsers(): Promise<boolean> {
  const firstUser = await db.query.users.findFirst();
  return !!firstUser;
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(
  password: string,
  hash: string,
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function createSession(userId: string): {
  sessionId: string;
  expiresAt: Date;
} {
  const sessionId = crypto.randomUUID();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + SESSION_TTL_MS);

  db.insert(sessions)
    .values({
      id: sessionId,
      userId,
      expiresAt: expiresAt.toISOString(),
      createdAt: now.toISOString(),
    })
    .run();

  return { sessionId, expiresAt };
}

export async function getSession(sessionId: string) {
  const session = await db.query.sessions.findFirst({
    where: eq(sessions.id, sessionId),
  });

  if (!session) return null;

  if (new Date(session.expiresAt) < new Date()) {
    db.delete(sessions).where(eq(sessions.id, sessionId)).run();
    return null;
  }

  return session;
}

export function deleteSession(sessionId: string): void {
  db.delete(sessions).where(eq(sessions.id, sessionId)).run();
}

export function cleanExpiredSessions(): void {
  const now = new Date().toISOString();
  db.delete(sessions).where(lt(sessions.expiresAt, now)).run();
}

export async function getUserByUsername(username: string) {
  return db.query.users.findFirst({
    where: eq(users.username, username),
  });
}

export async function getUserById(userId: string) {
  return db.query.users.findFirst({
    where: eq(users.id, userId),
  });
}

export async function getAllUsers() {
  const allUsers = await db.query.users.findMany();
  return allUsers.map(({ passwordHash, ...rest }) => rest);
}

export async function createUser(
  username: string,
  password: string,
  role: 'admin' | 'user',
) {
  const passwordHash = await hashPassword(password);
  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  db.insert(users)
    .values({ id, username, passwordHash, role, createdAt: now })
    .run();

  return { id, username, role, createdAt: now };
}

export async function deleteUserById(userId: string) {
  const userChats = await db.query.chats.findMany({
    where: eq(chats.userId, userId),
    columns: { id: true },
  });
  db.transaction((tx) => {
    for (const chat of userChats) {
      tx.delete(messages).where(eq(messages.chatId, chat.id)).run();
    }
    tx.delete(chats).where(eq(chats.userId, userId)).run();
    tx.delete(sessions).where(eq(sessions.userId, userId)).run();
    tx.delete(users).where(eq(users.id, userId)).run();
  });
}

export async function resetPasswordById(userId: string, newPassword: string) {
  const user = await getUserById(userId);
  if (!user) {
    throw new Error('User not found');
  }
  const passwordHash = await hashPassword(newPassword);
  db.transaction((tx) => {
    tx.update(users)
      .set({ passwordHash })
      .where(eq(users.id, userId))
      .run();
    tx.delete(sessions).where(eq(sessions.userId, userId)).run();
  });
}

export async function isAdmin(userId: string): Promise<boolean> {
  const user = await getUserById(userId);
  return user?.role === 'admin';
}

/**
 * Verify the request is from an authenticated admin user.
 * Returns the user record on success, or a Response on failure.
 */
export async function requireAdmin(
  req: Request,
): Promise<
  | { user: { id: string; username: string; role: string; createdAt: string } }
  | { error: Response }
> {
  if (!getAuthEnabled()) {
    return {
      error: Response.json(
        { error: 'Authentication is not enabled' },
        { status: 403 },
      ),
    };
  }

  const userId = req.headers.get('x-user-id');
  if (!userId) {
    return {
      error: Response.json({ error: 'Not authenticated' }, { status: 401 }),
    };
  }

  const user = await getUserById(userId);
  if (!user) {
    return {
      error: Response.json({ error: 'User not found' }, { status: 401 }),
    };
  }

  if (user.role !== 'admin') {
    return {
      error: Response.json({ error: 'Admin access required' }, { status: 403 }),
    };
  }

  return { user };
}
