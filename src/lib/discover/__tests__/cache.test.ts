import { afterEach, describe, expect, it, vi } from 'vitest';
import { createTtlCache } from '../cache';

describe('createTtlCache', () => {
  afterEach(() => vi.useRealTimers());

  it('reuses a fresh value and reloads after the TTL', async () => {
    vi.useFakeTimers();
    const cache = createTtlCache<number>(1000);
    const load = vi.fn().mockResolvedValueOnce(1).mockResolvedValueOnce(2);

    expect(await cache.get('k', load)).toBe(1);
    expect(await cache.get('k', load)).toBe(1);
    vi.advanceTimersByTime(1001);
    expect(await cache.get('k', load)).toBe(2);
    expect(load).toHaveBeenCalledTimes(2);
  });

  it('shares one load between concurrent calls', async () => {
    const cache = createTtlCache<number>(1000);
    const load = vi.fn().mockResolvedValue(7);
    const [a, b] = await Promise.all([
      cache.get('k', load),
      cache.get('k', load),
    ]);
    expect([a, b]).toEqual([7, 7]);
    expect(load).toHaveBeenCalledTimes(1);
  });

  it('serves the stale value when a reload fails, and throws without one', async () => {
    vi.useFakeTimers();
    const cache = createTtlCache<number>(1000);
    await cache.get('k', async () => 1);
    vi.advanceTimersByTime(1001);
    expect(
      await cache.get('k', async () => {
        throw new Error('down');
      }),
    ).toBe(1);
    await expect(
      cache.get('other', async () => {
        throw new Error('down');
      }),
    ).rejects.toThrow('down');
  });

  it('evicts the oldest entries past the limit', async () => {
    const cache = createTtlCache<number>(1000, 2);
    await cache.get('a', async () => 1);
    await cache.get('b', async () => 2);
    await cache.get('c', async () => 3);
    expect(cache.peek('a')).toBeUndefined();
    expect(cache.peek('c')).toBe(3);
  });
});
