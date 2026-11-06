import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const runMigrations = vi.fn();

vi.mock('@/lib/db/migrate', () => ({ runMigrations }));
vi.mock('@/lib/config/index', () => ({ default: {} }));

/* A failed migration used to be logged and swallowed: the server started
   without tables and every chat request failed with "no such table". */
describe('instrumentation register()', () => {
  const env = { ...process.env };

  beforeEach(() => {
    runMigrations.mockReset();
    process.env.NEXT_RUNTIME = 'nodejs';
    delete process.env.NEXT_PHASE;
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    process.env = { ...env };
    vi.restoreAllMocks();
  });

  it('runs the migrations at server start', async () => {
    const { register } = await import('@/instrumentation');
    await register();
    expect(runMigrations).toHaveBeenCalledTimes(1);
  });

  it('rethrows when the migrations fail, after logging', async () => {
    runMigrations.mockImplementation(() => {
      throw new Error('boom');
    });
    const { register } = await import('@/instrumentation');

    await expect(register()).rejects.toThrow('boom');
    expect(console.error).toHaveBeenCalled();
  });

  it('only logs during next build, so the build does not crash', async () => {
    process.env.NEXT_PHASE = 'phase-production-build';
    runMigrations.mockImplementation(() => {
      throw new Error('boom');
    });
    const { register } = await import('@/instrumentation');

    await expect(register()).resolves.toBeUndefined();
    expect(console.error).toHaveBeenCalled();
  });
});
