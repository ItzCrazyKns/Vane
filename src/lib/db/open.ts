import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';

/* `next build` imports every route module to collect page data, in several
   worker processes at once (one per CPU). Nothing reads the database during
   the build: the routes that use it are dynamic. */
export const isBuildPhase = () =>
  process.env.NEXT_PHASE === 'phase-production-build';

const sleep = (ms: number) =>
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);

/* Switching a file to WAL takes an exclusive lock. When two processes do it
   at the same moment, SQLite returns SQLITE_BUSY at once, without waiting on
   the busy timeout, so retry a few times before giving up. */
export function enableWal(
  sqlite: Pick<Database.Database, 'pragma'>,
  attempts = 10,
  delayMs = 50,
) {
  for (let i = 1; ; i++) {
    try {
      sqlite.pragma('journal_mode = WAL');
      break;
    } catch (err) {
      if ((err as { code?: string }).code !== 'SQLITE_BUSY' || i >= attempts)
        throw err;
      sleep(delayMs * i);
    }
  }
  sqlite.pragma('synchronous = NORMAL');
}

/* During the build the routes get an in-memory database, so the build workers
   never create or lock data/db.sqlite (they used to fail with "database is
   locked" and "Failed to collect page data for /api/..."), and the image does
   not get a database file from the build. */
export function openDatabase(dbPath: string): Database.Database {
  if (isBuildPhase()) return new Database(':memory:');

  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  const sqlite = new Database(dbPath);

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
  enableWal(sqlite);
  return sqlite;
}
