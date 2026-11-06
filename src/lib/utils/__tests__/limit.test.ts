import { describe, expect, it } from 'vitest';
import { createLimiter } from '../limit';

const tick = () => new Promise((r) => setTimeout(r, 5));

describe('createLimiter', () => {
  it('runs at most `max` functions at once, in FIFO order', async () => {
    const run = createLimiter(2);
    let active = 0;
    let peak = 0;
    const order: number[] = [];

    await Promise.all(
      [0, 1, 2, 3, 4].map((i) =>
        run(async () => {
          active += 1;
          peak = Math.max(peak, active);
          order.push(i);
          await tick();
          active -= 1;
        }),
      ),
    );

    expect(peak).toBe(2);
    expect(order).toEqual([0, 1, 2, 3, 4]);
  });

  it('frees the slot when a function rejects', async () => {
    const run = createLimiter(1);
    await expect(
      run(async () => Promise.reject(new Error('x'))),
    ).rejects.toThrow('x');
    await expect(run(async () => 'ok')).resolves.toBe('ok');
  });
});

describe('createLimiter with a timeout', () => {
  it('frees the slot of a task that never settles', async () => {
    const run = createLimiter(1, { timeoutMs: 20 });
    const hung = run(() => new Promise<never>(() => undefined));
    await expect(hung).rejects.toThrow(/timed out/);
    // The next task gets the slot instead of waiting forever.
    await expect(run(async () => 'ok')).resolves.toBe('ok');
  });

  it('does not free a slot twice when a timed-out task settles later', async () => {
    const run = createLimiter(1, { timeoutMs: 10 });
    let finishLate!: () => void;
    const late = run(() => new Promise<void>((r) => (finishLate = r)));
    await expect(late).rejects.toThrow(/timed out/);

    let active = 0;
    let peak = 0;
    const task = () =>
      run(async () => {
        active++;
        peak = Math.max(peak, active);
        await new Promise((r) => setTimeout(r, 5));
        active--;
      });
    const both = Promise.all([task(), task()]);
    finishLate();
    await both;
    expect(peak).toBe(1);
  });
});
