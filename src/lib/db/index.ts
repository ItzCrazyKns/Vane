import { drizzle } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';
import * as schema from './schema';
import path from 'path';
import fs from 'fs';
import { DATA_ROOT } from '../serverPaths';

fs.mkdirSync(DATA_ROOT, { recursive: true });
const sqlite = new Database(path.join(DATA_ROOT, 'db.sqlite'));
const db = drizzle(sqlite, {
  schema: schema,
});

export default db;
