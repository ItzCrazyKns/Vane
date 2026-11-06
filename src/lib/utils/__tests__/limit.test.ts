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
