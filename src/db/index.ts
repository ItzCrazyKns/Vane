import { drizzle } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';
import * as schema from './schema';

const sqlite = new Database('data/db.sqlite');
const db = drizzle(sqlite, {
  schema: schema,
});

export default db;
