import db from './';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import path from 'path';

migrate(db, { migrationsFolder: path.join(process.cwd(), 'drizzle') });
