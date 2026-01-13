import { drizzle } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';
import * as schema from './schema';
import path from 'path';

const DATA_DIR = process.env.DATA_DIR || process.cwd();
const sqlite = new Database(path.join(DATA_DIR, './data/db.sqlite'));
const db = drizzle(sqlite, {
  schema: schema,
});

// Export the underlying sqlite connection for transactions
export { sqlite };

export default db;
