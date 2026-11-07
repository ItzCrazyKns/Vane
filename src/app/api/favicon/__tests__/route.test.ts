/* GET /api/favicon serves a site's icon from the server. A site without an
   icon used to get a 404, and the browser logs every 404 image as a
   console error: one per source in each answer. 204 still fires the
   image's onError (hideBrokenImage) but is not logged. */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { fetchPublicURL } = vi.hoisted(() => ({ fetchPublicURL: vi.fn() }));
vi.mock('@/lib/security/urlGuard', () => ({ fetchPublicURL }));

import { GET } from '../route';

/* The route caches by domain for the whole module, so each case uses its
   own domain. */
const get = (domain: string) =>
  GET(new Request(`http://localhost/api/favicon?domain=${domain}`));

/* Braces: a function returned from beforeEach runs as a teardown. */
beforeEach(() => {
  fetchPublicURL.mockReset();
});

describe('GET /api/favicon', () => {
  it('serves the icon with its type', async () => {
    fetchPublicURL.mockResolvedValue(
      new Response(new Uint8Array([1, 2, 3]), {
        headers: { 'content-type': 'image/x-icon' },
      }),
    );
    const res = await get('a.test');
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('image/x-icon');
    expect(new Uint8Array(await res.arrayBuffer())).toEqual(
      new Uint8Array([1, 2, 3]),
    );
  });

  const misses: Record<string, () => void> = {
    'the site has no icon': () =>
      fetchPublicURL.mockResolvedValue(new Response('nope', { status: 404 })),
    'the answer is not an image': () =>
      fetchPublicURL.mockResolvedValue(
        new Response('<html>', { headers: { 'content-type': 'text/html' } }),
      ),
    'the host is unreachable': () =>
      fetchPublicURL.mockRejectedValue(new TypeError('fetch failed')),
  };

  it.each(Object.keys(misses))('answers 204, cached, when %s', async (name) => {
    misses[name]();
    const domain = `${name.replace(/\W+/g, '-')}.test`;
    const res = await get(domain);
    expect(res.status).toBe(204);
    expect(res.headers.get('cache-control')).toContain('max-age=3600');
    expect((await get(domain)).status).toBe(204);
    expect(fetchPublicURL).toHaveBeenCalledTimes(1);
  });

  it('rejects an invalid domain with 400', async () => {
    expect((await get('not_a_domain')).status).toBe(400);
    expect(fetchPublicURL).not.toHaveBeenCalled();
  });
});
