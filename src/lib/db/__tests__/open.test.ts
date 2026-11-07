import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterAll, afterEach, describe, expect, it, vi } from 'vitest';
import { enableWal, openDatabase } from '../open';

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vane-db-open-'));
afterAll(() => fs.rmSync(dir, { recursive: true, force: true }));

const busy = () =>
  Object.assign(new Error('database is locked'), { code: 'SQLITE_BUSY' });

describe('enableWal', () => {
  it('retries when another process holds the lock', () => {
    let calls = 0;
    const pragma = vi.fn((sql: string) => {
      if (sql === 'journal_mode = WAL' && ++calls < 3) throw busy();
    });

    enableWal({ pragma } as any, 5, 1);

    expect(calls).toBe(3);
    expect(pragma).toHaveBeenLastCalledWith('synchronous = NORMAL');
  });

  it('gives up after the last attempt', () => {
    const pragma = vi.fn(() => {
      throw busy();
    });
    expect(() => enableWal({ pragma } as any, 3, 1)).toThrow(
      'database is locked',
    );
    expect(pragma).toHaveBeenCalledTimes(3);
  });

  it('does not retry other errors', () => {
    const pragma = vi.fn(() => {
      throw Object.assign(new Error('disk I/O error'), {
        code: 'SQLITE_IOERR',
      });
    });
    expect(() => enableWal({ pragma } as any, 5, 1)).toThrow('disk I/O');
    expect(pragma).toHaveBeenCalledTimes(1);
  });
});

describe('openDatabase', () => {
  const phase = process.env.NEXT_PHASE;
  afterEach(() => {
    if (phase === undefined) delete process.env.NEXT_PHASE;
    else process.env.NEXT_PHASE = phase;
  });

  it('opens the file in WAL mode', () => {
    const file = path.join(dir, 'run', 'data', 'db.sqlite');
    const db = openDatabase(file);
    expect(db.pragma('journal_mode', { simple: true })).toBe('wal');
    db.close();
    expect(fs.existsSync(file)).toBe(true);
  });

  it('does not touch the disk during next build', () => {
    process.env.NEXT_PHASE = 'phase-production-build';
    const file = path.join(dir, 'build', 'data', 'db.sqlite');
    const db = openDatabase(file);
    expect(db.memory).toBe(true);
    db.close();
    expect(fs.existsSync(path.dirname(file))).toBe(false);
  });
});
