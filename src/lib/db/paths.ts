import path from 'path';

/* User state (db.sqlite, config.json, uploads) lives under DATA_DIR/data.
   DATA_DIR defaults to the app folder. */
export const getDataDir = () => process.env.DATA_DIR || process.cwd();

export const getDbPath = () => path.join(getDataDir(), 'data', 'db.sqlite');

/* Migrations ship with the app, not with the user data: in dev the app folder
   is the repo root, and in Docker it is /home/vane, where the Dockerfiles
   copy drizzle/ next to the standalone server.js (which chdirs to its own
   folder on start). They must never be looked up under DATA_DIR, which can
   be a separate volume. */
export const getMigrationsFolder = () => path.join(process.cwd(), 'drizzle');
