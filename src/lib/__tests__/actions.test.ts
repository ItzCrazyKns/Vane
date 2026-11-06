import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getSuggestions } from '../actions';

const respond = (status: number, body: unknown) =>
  vi.fn(
    async () =>
      new Response(JSON.stringify(body), {
        status,
        headers: { 'Content-Type': 'application/json' },
      }),
  );

beforeEach(() => {
  vi.stubGlobal('localStorage', { getItem: () => 'x' });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('getSuggestions', () => {
  it('returns the suggestions on success', async () => {
    vi.stubGlobal('fetch', respond(200, { suggestions: ['a', 'b'] }));

    expect(await getSuggestions([])).toEqual(['a', 'b']);
  });

  it('returns an empty list when the request fails', async () => {
    vi.stubGlobal(
      'fetch',
      respond(500, { message: 'An error occurred while generating' }),
    );

    expect(await getSuggestions([])).toEqual([]);
  });

  it('returns an empty list when the body has no suggestions', async () => {
    vi.stubGlobal('fetch', respond(200, {}));

    expect(await getSuggestions([])).toEqual([]);
  });

  it('returns an empty list when the network fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new TypeError('fetch failed');
      }),
    );

    expect(await getSuggestions([])).toEqual([]);
  });
});
