import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from './schema';
import { getDbPath } from './paths';
import { openDatabase } from './open';

const sqlite = openDatabase(getDbPath());

const db = drizzle(sqlite, {
  schema: schema,
});

export default db;
