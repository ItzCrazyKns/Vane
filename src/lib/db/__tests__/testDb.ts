import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import fs from 'fs';
import path from 'path';
import * as schema from '../schema';

/**
 * Builds a SQLite database shaped like a real install: the tables as left by
 * migration 0002 (which the hand-rolled runner special-cases), then every
 * later drizzle/*.sql applied statement by statement, as migrate.ts does.
 */
export const createTestSqlite = (file = ':memory:') => {
  const sqlite = new Database(file);
  sqlite.exec(`
    CREATE TABLE chats (
      id TEXT PRIMARY KEY, title TEXT NOT NULL, createdAt TEXT NOT NULL,
      sources TEXT DEFAULT '[]', files TEXT DEFAULT '[]');
    CREATE TABLE messages (
      id INTEGER PRIMARY KEY, messageId TEXT NOT NULL, chatId TEXT NOT NULL,
      backendId TEXT NOT NULL, query TEXT NOT NULL, createdAt TEXT NOT NULL,
      responseBlocks TEXT DEFAULT '[]', status TEXT DEFAULT 'answering');
  `);
  const dir = path.resolve(__dirname, '../../../../drizzle');
  fs.readdirSync(dir)
    .filter((f) => f.endsWith('.sql') && Number(f.split('_')[0]) >= 3)
    .sort()
    .forEach((f) =>
      fs
        .readFileSync(path.join(dir, f), 'utf-8')
        .split(/--> statement-breakpoint/g)
        .map((s) => s.trim())
        .filter(Boolean)
        .forEach((s) => sqlite.exec(s)),
    );
  return sqlite;
};

export const createTestDb = (file?: string) => {
  const sqlite = createTestSqlite(file);
  return { sqlite, db: drizzle(sqlite, { schema }) };
};
