type Entry<T> = { value: T; expiresAt: number };

/**
 * Small in-memory cache for Discover results.
 *
 * - Fresh values are served for `ttlMs`.
 * - Concurrent calls for the same key share one in-flight load.
 * - When a load fails, the last value (even if expired) is served instead,
 *   so a flaky source does not empty the feed. With no previous value the
 *   error is rethrown.
 */
export const createTtlCache = <T>(ttlMs: number, maxEntries = 200) => {
  const entries = new Map<string, Entry<T>>();
  const inFlight = new Map<string, Promise<T>>();

  const set = (key: string, value: T) => {
    entries.delete(key);
    entries.set(key, { value, expiresAt: Date.now() + ttlMs });
    while (entries.size > maxEntries) {
      const oldest = entries.keys().next().value;
      if (oldest === undefined) break;
      entries.delete(oldest);
    }
  };

  const get = async (key: string, load: () => Promise<T>): Promise<T> => {
    const cached = entries.get(key);
    if (cached && cached.expiresAt > Date.now()) return cached.value;

    const pending = inFlight.get(key);
    if (pending) return pending;

    const promise = (async () => {
      try {
        const value = await load();
        set(key, value);
        return value;
      } catch (err) {
        if (cached) return cached.value;
        throw err;
      } finally {
        inFlight.delete(key);
      }
    })();

    inFlight.set(key, promise);
    return promise;
  };

  return {
    get,
    /** Last stored value for a key, fresh or not. */
    peek: (key: string) => entries.get(key)?.value,
    clear: () => {
      entries.clear();
      inFlight.clear();
    },
  };
};
