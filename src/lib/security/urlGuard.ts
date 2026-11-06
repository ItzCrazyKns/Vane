import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';

/**
 * Guards for URLs that the model (or a page it read) chooses, such as the
 * `scrape_url` action. Without them a prompt-injected page could make the
 * server read internal services: cloud metadata (169.254.169.254), the Vane
 * API itself on localhost, or anything else on the LAN.
 *
 * Set `VANE_ALLOW_PRIVATE_URLS=true` to let the researcher read private
 * addresses on purpose (for example an intranet wiki).
 */

export class BlockedURLError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BlockedURLError';
  }
}

export type LookupFn = (
  hostname: string,
) => Promise<{ address: string; family: number }[]>;

const defaultLookup: LookupFn = (hostname) =>
  lookup(hostname, { all: true, verbatim: true });

const ipv4ToInt = (ip: string) =>
  ip.split('.').reduce((acc, part) => acc * 256 + Number(part), 0);

const V4_BLOCKED: [string, number][] = [
  ['0.0.0.0', 8],
  ['10.0.0.0', 8],
  ['100.64.0.0', 10],
  ['127.0.0.0', 8],
  ['169.254.0.0', 16],
  ['172.16.0.0', 12],
  ['192.0.0.0', 24],
  ['192.0.2.0', 24],
  ['192.168.0.0', 16],
  ['198.18.0.0', 15],
  ['198.51.100.0', 24],
  ['203.0.113.0', 24],
  ['224.0.0.0', 4],
  ['240.0.0.0', 4],
];

const isBlockedIPv4 = (ip: string) => {
  const value = ipv4ToInt(ip);
  return V4_BLOCKED.some(([base, bits]) => {
    const start = ipv4ToInt(base);
    return value >= start && value < start + 2 ** (32 - bits);
  });
};

/** Expands an IPv6 address into its eight 16-bit groups. */
const ipv6Groups = (ip: string): number[] | null => {
  let addr = ip.toLowerCase();
  const zone = addr.indexOf('%');
  if (zone !== -1) addr = addr.slice(0, zone);

  /* Trailing dotted IPv4 (e.g. ::ffff:127.0.0.1). */
  const lastColon = addr.lastIndexOf(':');
  const tail = addr.slice(lastColon + 1);
  if (tail.includes('.')) {
    if (isIP(tail) !== 4) return null;
    const v = ipv4ToInt(tail);
    addr = `${addr.slice(0, lastColon + 1)}${Math.floor(v / 65536).toString(16)}:${(v % 65536).toString(16)}`;
  }

  const compressed = addr.includes('::');
  const [head, rest] = addr.split('::');
  const headParts = head ? head.split(':') : [];
  const restParts = rest ? rest.split(':') : [];
  const missing = 8 - headParts.length - restParts.length;
  if (compressed ? missing < 0 : missing !== 0) return null;

  const groups = [
    ...headParts,
    ...Array(compressed ? missing : 0).fill('0'),
    ...restParts,
  ].map((p) => (/^[0-9a-f]{1,4}$/.test(p) ? parseInt(p, 16) : NaN));

  return groups.length === 8 && groups.every((g) => !Number.isNaN(g))
    ? groups
    : null;
};

const isBlockedIPv6 = (ip: string) => {
  const g = ipv6Groups(ip);
  if (!g) return true;

  const zeroUntil = (n: number) => g.slice(0, n).every((x) => x === 0);

  if (zeroUntil(8)) return true; // ::
  if (zeroUntil(7) && g[7] === 1) return true; // ::1
  if ((g[0] & 0xfe00) === 0xfc00) return true; // fc00::/7 unique local
  if ((g[0] & 0xffc0) === 0xfe80) return true; // fe80::/10 link local
  if ((g[0] & 0xff00) === 0xff00) return true; // ff00::/8 multicast

  /* IPv4-mapped (::ffff:a.b.c.d), IPv4-compatible and NAT64 64:ff9b::/96. */
  const embedsV4 =
    (zeroUntil(5) && (g[5] === 0xffff || g[5] === 0)) ||
    (g[0] === 0x64 && g[1] === 0xff9b && g.slice(2, 6).every((x) => x === 0));

  if (embedsV4) {
    return isBlockedIPv4(
      `${g[6] >> 8}.${g[6] & 0xff}.${g[7] >> 8}.${g[7] & 0xff}`,
    );
  }

  return false;
};

/** True for loopback, private, link-local, reserved and unparsable addresses. */
export const isBlockedAddress = (ip: string): boolean => {
  const family = isIP(ip);
  if (family === 4) return isBlockedIPv4(ip);
  if (family === 6) return isBlockedIPv6(ip);
  return true;
};

export const privateURLsAllowed = () =>
  String(process.env.VANE_ALLOW_PRIVATE_URLS ?? '').toLowerCase() === 'true';

/**
 * Throws BlockedURLError unless `rawURL` is http(s) and every address its host
 * resolves to is public. Returns the parsed URL.
 */
export const assertPublicHttpURL = async (
  rawURL: string,
  resolve: LookupFn = defaultLookup,
): Promise<URL> => {
  let url: URL;
  try {
    url = new URL(rawURL);
  } catch {
    throw new BlockedURLError(`Invalid URL: ${rawURL}`);
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new BlockedURLError(`Unsupported URL scheme: ${url.protocol}`);
  }

  if (url.username || url.password) {
    throw new BlockedURLError('URLs with credentials are not fetched');
  }

  if (privateURLsAllowed()) return url;

  const hostname = url.hostname.replace(/^\[|\]$/g, '');
  const literal = isIP(hostname);

  let addresses: { address: string; family: number }[];
  if (literal) {
    addresses = [{ address: hostname, family: literal }];
  } else {
    try {
      addresses = await resolve(hostname);
    } catch {
      throw new BlockedURLError(`Could not resolve ${hostname}`);
    }
  }

  if (addresses.length === 0) {
    throw new BlockedURLError(`Could not resolve ${hostname}`);
  }

  if (addresses.some((a) => isBlockedAddress(a.address))) {
    throw new BlockedURLError(
      `Refusing to fetch ${hostname}: it points to a private or local address`,
    );
  }

  return url;
};

const MAX_REDIRECTS = 5;

/**
 * `fetch` for model-chosen URLs: checks the URL and every redirect target with
 * assertPublicHttpURL. The `redirect` option of `init` is ignored.
 */
export const fetchPublicURL = async (
  rawURL: string,
  init: RequestInit = {},
  resolve: LookupFn = defaultLookup,
): Promise<Response> => {
  let current = rawURL;

  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const url = await assertPublicHttpURL(current, resolve);
    const res = await fetch(url, { ...init, redirect: 'manual' });

    const location = res.headers.get('location');
    if (res.status >= 300 && res.status < 400 && location) {
      await res.body?.cancel().catch(() => {});
      current = new URL(location, url).toString();
      continue;
    }

    return res;
  }

  throw new BlockedURLError(`Too many redirects: ${rawURL}`);
};
