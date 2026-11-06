/**
 * Request checks for the API routes, run by `src/proxy.ts`.
 *
 * Vane has no login, so its API trusts whoever can reach it. These checks keep
 * other web sites from using the user's browser to reach it:
 *
 * - Host allow list: blocks DNS rebinding, where an attacker's domain is
 *   pointed at 127.0.0.1 so their page can read responses such as
 *   `/api/config`. Local names (localhost, IP literals, single-label names
 *   such as a Docker service, `.local`/`.lan`/`.internal`/`.home.arpa`) are
 *   always allowed; public domains must be listed in `VANE_ALLOWED_HOSTS`.
 * - Same-origin writes: a browser request that changes state (anything but
 *   GET/HEAD/OPTIONS) must come from the app's own origin. This blocks CSRF,
 *   including `text/plain` "simple" requests that skip the CORS preflight.
 *   Requests without `Origin` and `Sec-Fetch-Site` (curl, scripts, the
 *   documented `/api/search` clients) are not browser CSRF and pass.
 */

export type GuardInput = {
  method: string;
  host: string | null;
  forwardedHost?: string | null;
  origin?: string | null;
  secFetchSite?: string | null;
  allowedHosts?: string | null;
};

export type GuardResult = { status: number; message: string } | null;

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

const LOCAL_SUFFIXES = [
  '.localhost',
  '.local',
  '.lan',
  '.internal',
  '.home.arpa',
];

/** Lower-cased hostname of a `Host` value, without port or IPv6 brackets. */
export const hostnameOf = (host: string): string => {
  const h = host.trim().toLowerCase();

  if (h.startsWith('[')) {
    const end = h.indexOf(']');
    return end === -1 ? h : h.slice(1, end);
  }

  const colon = h.lastIndexOf(':');
  /* A bare IPv6 address has several colons and no port. */
  if (colon !== -1 && h.indexOf(':') === colon) return h.slice(0, colon);

  return h;
};

const isIPv4 = (h: string) =>
  /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.test(h) &&
  h.split('.').every((p) => Number(p) <= 255);

const isIPv6 = (h: string) => h.includes(':') && /^[0-9a-f:.]+$/.test(h);

const isLocalHostname = (h: string) =>
  h === 'localhost' ||
  isIPv4(h) ||
  isIPv6(h) ||
  !h.includes('.') ||
  LOCAL_SUFFIXES.some((s) => h.endsWith(s));

const parseAllowedHosts = (value?: string | null) =>
  (value ?? '')
    .split(',')
    .map((h) => h.trim().toLowerCase())
    .filter(Boolean);

export const isHostAllowed = (
  host: string,
  allowedHosts?: string | null,
): boolean => {
  const hostname = hostnameOf(host);
  if (!hostname) return false;
  if (isLocalHostname(hostname)) return true;

  return parseAllowedHosts(allowedHosts).some((entry) => {
    if (entry === '*') return true;
    const pattern = hostnameOf(entry);
    if (pattern.startsWith('*.')) return hostname.endsWith(pattern.slice(1));
    return hostname === pattern;
  });
};

const originHost = (origin: string): string | null => {
  try {
    return new URL(origin).host.toLowerCase();
  } catch {
    return null;
  }
};

const BLOCKED_CROSS_ORIGIN: GuardResult = {
  status: 403,
  message: 'Cross-origin request blocked.',
};

export const checkApiRequest = (input: GuardInput): GuardResult => {
  const host = input.host?.trim() ?? '';

  if (!host || !isHostAllowed(host, input.allowedHosts)) {
    return {
      status: 403,
      message: `Host "${hostnameOf(host)}" is not allowed. Add it to VANE_ALLOWED_HOSTS to reach Vane through this name.`,
    };
  }

  if (SAFE_METHODS.has(input.method.toUpperCase())) return null;

  const origin = input.origin?.trim();

  if (origin) {
    const fromHost = originHost(origin);
    const ownHosts = [host, input.forwardedHost]
      .filter((h): h is string => !!h)
      .flatMap((h) => h.split(','))
      .map((h) => h.trim().toLowerCase());

    return fromHost && ownHosts.includes(fromHost)
      ? null
      : BLOCKED_CROSS_ORIGIN;
  }

  const site = input.secFetchSite?.trim().toLowerCase();
  if (site && site !== 'same-origin' && site !== 'none') {
    return BLOCKED_CROSS_ORIGIN;
  }

  return null;
};
