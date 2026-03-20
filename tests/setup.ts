/**
 * Test setup: creates an isolated in-memory SQLite database
 * and wires it into the app modules via vi.mock().
 */
import { vi } from 'vitest';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from '@/lib/db/schema';

// Create in-memory database for tests
const sqlite = new Database(':memory:');
const testDb = drizzle(sqlite, { schema });

// Run DDL to create tables
sqlite.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY NOT NULL,
    username TEXT NOT NULL UNIQUE,
    passwordHash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'user',
    createdAt TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY NOT NULL,
    userId TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expiresAt TEXT NOT NULL,
    createdAt TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS chats (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    createdAt TEXT NOT NULL,
    sources TEXT DEFAULT '[]',
    files TEXT DEFAULT '[]',
    userId TEXT
  );
  CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY,
    messageId TEXT NOT NULL,
    chatId TEXT NOT NULL,
    backendId TEXT NOT NULL,
    query TEXT NOT NULL,
    createdAt TEXT NOT NULL,
    responseBlocks TEXT DEFAULT '[]',
    status TEXT DEFAULT 'answering'
  );
`);

// Mock the db module so all app code uses the in-memory DB
vi.mock('@/lib/db', () => ({ default: testDb }));

// Set a stable session secret for tests
process.env.SESSION_SECRET = 'test-secret-key-for-vitest-do-not-use-in-prod';
process.env.AUTH_ENABLED = 'true';

// Export for direct use in test files
export { sqlite, testDb };
