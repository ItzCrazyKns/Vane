import { describe, expect, it, vi } from 'vitest';
import { openReconnectStream } from '@/lib/hooks/reconnectStream';

describe('openReconnectStream', () => {
  it('returns the body of a live session', async () => {
    const fetchImpl = vi.fn(
      async () => new Response('{"type":"messageEnd"}\n', { status: 200 }),
    );

    const body = await openReconnectStream('abc', fetchImpl);

    expect(fetchImpl).toHaveBeenCalledWith('/api/reconnect/abc', {
      method: 'POST',
    });
    expect(body).not.toBeNull();
    expect(await new Response(body).text()).toBe('{"type":"messageEnd"}\n');
  });

  it('returns null when the session is gone (404)', async () => {
    const fetchImpl = vi.fn(async () =>
      Response.json({ message: 'Session not found' }, { status: 404 }),
    );

    expect(await openReconnectStream('gone', fetchImpl)).toBeNull();
  });

  it('returns null on a server error', async () => {
    const fetchImpl = vi.fn(async () =>
      Response.json({ message: 'An error has occurred.' }, { status: 500 }),
    );

    expect(await openReconnectStream('x', fetchImpl)).toBeNull();
  });

  it('returns null when the network fails', async () => {
    const fetchImpl = vi.fn(async () => {
      throw new TypeError('fetch failed');
    });

    expect(await openReconnectStream('x', fetchImpl)).toBeNull();
  });
});
