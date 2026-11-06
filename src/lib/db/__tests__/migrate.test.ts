import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import Database from 'better-sqlite3';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/* DATA_DIR pointing at a folder other than the app folder (e.g. a Docker
   volume) used to make the runner look for drizzle/ inside DATA_DIR, fail,
   and leave the app without tables. */
describe('database migrations with DATA_DIR outside the app folder', () => {
  let dataDir: string;
  const originalDataDir = process.env.DATA_DIR;

  beforeEach(() => {
    dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vane-migrate-'));
    process.env.DATA_DIR = dataDir;
    vi.resetModules();
  });

  afterEach(() => {
    if (originalDataDir === undefined) delete process.env.DATA_DIR;
    else process.env.DATA_DIR = originalDataDir;
    fs.rmSync(dataDir, { recursive: true, force: true });
  });

  const tables = (dbPath: string) => {
    const db = new Database(dbPath, { readonly: true });
    try {
      return (
        db
          .prepare("SELECT name FROM sqlite_master WHERE type = 'table'")
          .all() as { name: string }[]
      ).map((r) => r.name);
    } finally {
      db.close();
    }
  };

  it('reads migrations from the app folder and creates the tables in DATA_DIR', async () => {
    const { runMigrations } = await import('../migrate');

    runMigrations();

    const dbPath = path.join(dataDir, 'data', 'db.sqlite');
    expect(fs.existsSync(dbPath)).toBe(true);
    expect(tables(dbPath)).toEqual(
      expect.arrayContaining(['chats', 'messages', 'ran_migrations']),
    );
  });

  it('is idempotent', async () => {
    const { runMigrations } = await import('../migrate');

    runMigrations();
    runMigrations();

    const db = new Database(path.join(dataDir, 'data', 'db.sqlite'), {
      readonly: true,
    });
    const ran = db.prepare('SELECT name FROM ran_migrations').all();
    db.close();
    // One row per migration file, even after running twice.
    const files = fs
      .readdirSync(path.join(process.cwd(), 'drizzle'))
      .filter((f) => f.endsWith('.sql'));
    expect(ran).toHaveLength(files.length);
  });

  it('throws a clear error when the migrations folder is missing', async () => {
    const { runMigrations } = await import('../migrate');

    expect(() =>
      runMigrations({ migrationsFolder: path.join(dataDir, 'nope') }),
    ).toThrow(/migrations folder not found/i);
  });

  it('resolves the migrations folder from the app folder, not DATA_DIR', async () => {
    const { getMigrationsFolder, getDbPath } = await import('../paths');

    expect(getMigrationsFolder()).toBe(path.join(process.cwd(), 'drizzle'));
    expect(getDbPath()).toBe(path.join(dataDir, 'data', 'db.sqlite'));
  });
});
