import { drizzle } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';
import * as schema from './schema';
import path from 'path';

const DATA_DIR = process.env.DATA_DIR || process.cwd();
const sqlite = new Database(path.join(DATA_DIR, './data/db.sqlite'));

/*
 * WAL lets the history/library reads run while an answer is being saved
 * instead of waiting on the rollback-journal lock, and with it
 * synchronous=NORMAL drops the fsync on every commit (WAL is synced only at
 * checkpoints). The database stays consistent after a crash; at worst the
 * last commits before a power loss are rolled back. Safe here because a
 * single Next.js process owns data/db.sqlite on local disk (WAL does not
 * work on network filesystems). journal_mode=WAL is persisted in the file;
 * synchronous is per connection.
 */
sqlite.pragma('journal_mode = WAL');
sqlite.pragma('synchronous = NORMAL');

const db = drizzle(sqlite, {
  schema: schema,
});

export default db;
