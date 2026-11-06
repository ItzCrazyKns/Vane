import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/firecrawl', () => ({
  getFirecrawlConfig: () => null,
  firecrawlHeaders: () => ({}),
}));

const fetchPublicURL = vi.fn();
vi.mock('@/lib/security/urlGuard', () => ({
  assertPublicHttpURL: async () => {},
  fetchPublicURL: (...args: any[]) => fetchPublicURL(...args),
}));

import Scraper from '../scraper';

const CHUNK = 64 * 1024;

/* A response whose body is produced lazily, so we can count how many
   bytes the scraper actually pulled. */
const hugeResponse = (totalBytes: number, contentType: string) => {
  let sent = 0;
  const piece = new TextEncoder().encode(
    '<p>Rust keeps memory safe. </p>'.repeat(CHUNK / 32).slice(0, CHUNK),
  );
  const body = new ReadableStream<Uint8Array>({
    pull(controller) {
      if (sent >= totalBytes) {
        controller.close();
        return;
      }
      sent += piece.byteLength;
      controller.enqueue(piece);
    },
  });
  return {
    res: new Response(body, {
      status: 200,
      headers: { 'content-type': contentType },
    }),
    read: () => sent,
  };
};

describe('Scraper plain fetch size limit', () => {
  it('stops reading a page body after MAX_FETCH_BYTES', async () => {
    const total = 50 * 1024 * 1024;
    const { res, read } = hugeResponse(total, 'text/plain');
    fetchPublicURL.mockResolvedValue(res);

    const out = await Scraper.scrape('https://big.test/page');

    console.log(
      `[perf] scraper: read ${(read() / 1024 / 1024).toFixed(1)} MB of a ${total / 1024 / 1024} MB body`,
    );
    expect(read()).toBeLessThanOrEqual(Scraper.MAX_FETCH_BYTES + 2 * CHUNK);
    expect(out.content.length).toBeGreaterThan(1000);
    expect(out.content.length).toBeLessThanOrEqual(
      Scraper.MAX_FETCH_BYTES + 200,
    );
  });

  it('reads small pages whole', async () => {
    fetchPublicURL.mockResolvedValue(
      new Response(
        '<html><head><title>T</title></head><body><article><p>Hello there, this is the article body.</p></article></body></html>',
        { status: 200, headers: { 'content-type': 'text/html' } },
      ),
    );

    const out = await Scraper.scrape('https://small.test/');
    expect(out.content).toContain('Hello there, this is the article body.');
  });
});
