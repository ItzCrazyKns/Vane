/**
 * Tiny concurrency limiter (no dependency): at most `max` of the functions
 * passed to the returned `run` are in flight at once; the others wait in
 * FIFO order. A rejected function frees its slot like a resolved one.
 * With `timeoutMs`, a function that has not settled by then is rejected
 * for its caller and its slot is freed, so one hung request cannot block
 * every later caller forever.
 */
export const createLimiter = (
  max: number,
  options: { timeoutMs?: number } = {},
) => {
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
    let released = false;
    const releaseOnce = () => {
      if (released) return;
      released = true;
      release();
    };
    const task = Promise.resolve().then(fn);
    task.then(releaseOnce, releaseOnce);
    if (!options.timeoutMs) return task;

    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        releaseOnce();
        reject(new Error(`Task timed out after ${options.timeoutMs} ms`));
      }, options.timeoutMs);
    });
    try {
      return await Promise.race([task, timeout]);
    } finally {
      clearTimeout(timer);
    }
  };

  return run;
};
