/**
 * Tiny concurrency limiter (no dependency): at most `max` of the functions
 * passed to the returned `run` are in flight at once; the others wait in
 * FIFO order. A rejected function frees its slot like a resolved one.
 */
export const createLimiter = (max: number) => {
  const limit = Math.max(1, Math.floor(max));
  let active = 0;
  const waiting: (() => void)[] = [];

  const acquire = async () => {
    if (active < limit) {
      active += 1;
      return;
    }
    await new Promise<void>((resolve) => waiting.push(resolve));
  };

  const release = () => {
    const next = waiting.shift();
    if (next) {
      next(); /* hand the slot straight over */
    } else {
      active -= 1;
    }
  };

  const run = async <T>(fn: () => Promise<T>): Promise<T> => {
    await acquire();
    try {
      return await fn();
    } finally {
      release();
    }
  };

  return run;
};
