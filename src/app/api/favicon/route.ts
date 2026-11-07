import { fetchPublicURL } from '@/lib/security/urlGuard';

/**
 * Serves a site's favicon from the server, so the browser does not send the
 * pages the user researched to a third-party favicon service. Only the
 * hostname is used, and the fetch goes through the SSRF guard.
 */

const MAX_BYTES = 256 * 1024;
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const CACHE_MAX_ENTRIES = 500;

type Cached = { body: ArrayBuffer | null; type: string; at: number };

const cache = new Map<string, Cached>();

const HOSTNAME_RE = /^(?=.{1,253}$)([a-z0-9-]{1,63}\.)+[a-z0-9-]{2,63}$/;

const remember = (domain: string, entry: Cached) => {
  if (cache.size >= CACHE_MAX_ENTRIES) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
  cache.set(domain, entry);
};

const respond = (entry: Cached) =>
  entry.body
    ? new Response(entry.body, {
        status: 200,
        headers: {
          'Content-Type': entry.type,
          'Cache-Control': 'public, max-age=86400',
          'X-Content-Type-Options': 'nosniff',
          'Content-Security-Policy':
            "default-src 'none'; style-src 'unsafe-inline'",
        },
      })
    : /* 204, not 404: the <img> still fires onError (hideBrokenImage), but
         the browser does not log a console error for each source. */
      new Response(null, {
        status: 204,
        headers: { 'Cache-Control': 'public, max-age=3600' },
      });

const readLimited = async (res: Response): Promise<ArrayBuffer | null> => {
  const declared = Number(res.headers.get('content-length') || 0);
  if (declared > MAX_BYTES) return null;

  const reader = res.body?.getReader();
  if (!reader) return null;

  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > MAX_BYTES) {
      await reader.cancel().catch(() => {});
      return null;
    }
    chunks.push(value);
  }

  const out = new Uint8Array(size);
  let offset = 0;
  for (const c of chunks) {
    out.set(c, offset);
    offset += c.byteLength;
  }
  return out.buffer;
};

export const GET = async (req: Request) => {
  const domain = (new URL(req.url).searchParams.get('domain') || '')
    .trim()
    .toLowerCase();

  if (!HOSTNAME_RE.test(domain)) {
    return Response.json({ message: 'Invalid domain' }, { status: 400 });
  }

  const cached = cache.get(domain);
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) return respond(cached);

  let entry: Cached = { body: null, type: '', at: Date.now() };

  try {
    const res = await fetchPublicURL(`https://${domain}/favicon.ico`, {
      headers: { Accept: 'image/*' },
      signal: AbortSignal.timeout(5000),
    });

    const type = (res.headers.get('content-type') || '').split(';')[0].trim();

    if (res.ok && type.startsWith('image/')) {
      const body = await readLimited(res);
      /* SVG can carry script; only serve it with the CSP above. */
      if (body && body.byteLength > 0) entry = { body, type, at: Date.now() };
    } else {
      await res.body?.cancel().catch(() => {});
    }
  } catch {
    /* unreachable host, blocked address, timeout: cached as missing */
  }

  remember(domain, entry);
  return respond(entry);
};
