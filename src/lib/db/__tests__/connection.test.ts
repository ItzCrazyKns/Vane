import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterAll, describe, expect, it } from 'vitest';

const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vane-db-conn-'));
fs.mkdirSync(path.join(dataDir, 'data'));

afterAll(() => fs.rmSync(dataDir, { recursive: true, force: true }));

describe('db connection', () => {
  it('opens the database in WAL mode with synchronous=NORMAL', async () => {
    const prev = process.env.DATA_DIR;
    process.env.DATA_DIR = dataDir;
    try {
      const { default: db } = await import('@/lib/db');
      const client = db.$client;
      expect(client.pragma('journal_mode', { simple: true })).toBe('wal');
      // 1 = NORMAL (the default is 2 = FULL)
      expect(client.pragma('synchronous', { simple: true })).toBe(1);
      client.close();
    } finally {
      if (prev === undefined) delete process.env.DATA_DIR;
      else process.env.DATA_DIR = prev;
    }
  });
});
