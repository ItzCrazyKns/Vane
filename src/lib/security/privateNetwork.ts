import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';

/**
 * Destination policy for URLs that come from a user or a web page.
 *
 * The policy is shared by every server-side fetch of such a URL so the
 * address table, the IPv6 handling and the URL parsing rules cannot drift
 * between features. It answers one question: may this process send a request
 * to this URL?
 *
 * Only http and https are allowed. Two destination rules share this module:
 *
 * - `assertPublicHttpUrl` is the rule for URLs fetched on behalf of a page. A
 *   scraping target must be public: loopback, link-local, private, CGNAT,
 *   benchmark, documentation and multicast space is refused, because a page
 *   must not be able to reach a service on the same host.
 * - `assertProviderBaseUrl` is the rule for an operator-configured provider
 *   base URL. Ollama and LM Studio commonly run on the same host as Vane, and
 *   the README documents the Docker and Linux endpoints
 *   `http://host.docker.internal` and `http://<private_ip_of_host>`, so
 *   loopback destinations (127.0.0.0/8, ::1, localhost), the reserved
 *   `host.docker.internal` name and the private LAN ranges (10.0.0.0/8,
 *   172.16.0.0/12, 192.168.0.0/16) are legal there while every other blocked
 *   range still applies. The two rules stay separate because the same address
 *   is a safe provider endpoint and an unsafe scraping target.
 *
 * IPv6 addresses that carry an embedded IPv4 address (IPv4-mapped,
 * IPv4-compatible, NAT64 and 6to4) are decoded and checked against the IPv4
 * ranges, so `[::ffff:127.0.0.1]` is treated exactly like `127.0.0.1`.
 */

type ResolvedAddress = { address: string; family: number };

export type AddressLookup = (
  hostname: string,
  options: { all: true; verbatim: true },
) => Promise<ResolvedAddress[]>;

export interface UrlPolicyOptions {
  /** Test seam: override the resolver used for hostname checks. */
  lookup?: AddressLookup;
}

const defaultLookup: AddressLookup = (hostname, options) =>
  lookup(hostname, options);

const BLOCKED_IPV4_RANGES: ReadonlyArray<readonly [string, number]> = [
  ['0.0.0.0', 8], // "this" network
  ['10.0.0.0', 8], // private
  ['100.64.0.0', 10], // carrier-grade NAT
  ['127.0.0.0', 8], // loopback
  ['169.254.0.0', 16], // link-local, including cloud metadata
  ['172.16.0.0', 12], // private
  ['192.0.0.0', 24], // IETF protocol assignments
  ['192.0.2.0', 24], // TEST-NET-1
  ['192.88.99.0', 24], // 6to4 relay anycast
  ['192.168.0.0', 16], // private
  ['198.18.0.0', 15], // benchmarking
  ['198.51.100.0', 24], // TEST-NET-2
  ['203.0.113.0', 24], // TEST-NET-3
  ['224.0.0.0', 4], // multicast
  ['240.0.0.0', 4], // reserved, including broadcast
];

function ipv4ToInt(address: string): number {
  return (
    address.split('.').reduce((acc, octet) => acc * 256 + Number(octet), 0) >>>
    0
  );
}

function ipv4InRanges(
  address: string,
  ranges: ReadonlyArray<readonly [string, number]>,
): boolean {
  const value = ipv4ToInt(address);
  return ranges.some(([base, bits]) => {
    const size = 2 ** (32 - bits);
    return value >= ipv4ToInt(base) && value < ipv4ToInt(base) + size;
  });
}

export function isBlockedIpv4Address(address: string): boolean {
  if (isIP(address) !== 4) return true;
  return ipv4InRanges(address, BLOCKED_IPV4_RANGES);
}

/**
 * The private LAN ranges the README documents as the Linux Ollama and
 * Lemonade endpoint, `http://<private_ip_of_host>`. Only these three ranges
 * are exempt from the provider rule; every other blocked range stays refused.
 */
const PRIVATE_LAN_IPV4_RANGES: ReadonlyArray<readonly [string, number]> = [
  ['10.0.0.0', 8], // private
  ['172.16.0.0', 12], // private
  ['192.168.0.0', 16], // private
];

function isPrivateLanIpv4Address(address: string): boolean {
  return isIP(address) === 4 && ipv4InRanges(address, PRIVATE_LAN_IPV4_RANGES);
}

function ipv4FromHextets(high: number, low: number): string {
  return [high >> 8, high & 0xff, low >> 8, low & 0xff].join('.');
}

/**
 * Expand an IPv6 address to its eight 16-bit groups, including the embedded
 * IPv4 tail form (`::ffff:127.0.0.1`). Returns null for anything that is not
 * a well formed IPv6 address so the caller can fail closed.
 */
function ipv6ToHextets(address: string): number[] | null {
  let value = address.trim().toLowerCase();
  const zoneIndex = value.indexOf('%');
  if (zoneIndex !== -1) value = value.slice(0, zoneIndex);
  if (!value.includes(':')) return null;

  const lastColon = value.lastIndexOf(':');
  const tail = value.slice(lastColon + 1);
  if (tail.includes('.')) {
    const octets = tail.split('.');
    if (octets.length !== 4) return null;
    const numbers = octets.map((octet) =>
      /^\d{1,3}$/.test(octet) ? Number(octet) : Number.NaN,
    );
    if (
      numbers.some(
        (number) => !Number.isInteger(number) || number < 0 || number > 255,
      )
    ) {
      return null;
    }
    const high = ((numbers[0] << 8) | numbers[1]).toString(16);
    const low = ((numbers[2] << 8) | numbers[3]).toString(16);
    value = `${value.slice(0, lastColon + 1)}${high}:${low}`;
  }

  const halves = value.split('::');
  if (halves.length > 2) return null;
  const head = halves[0] === '' ? [] : halves[0].split(':');
  const rest =
    halves.length === 2 && halves[1] !== '' ? halves[1].split(':') : [];
  if (halves.length === 1 && head.length !== 8) return null;
  const missing = 8 - head.length - rest.length;
  if (halves.length === 2 && missing < 1) return null;
  const parts = [...head, ...new Array<string>(missing).fill('0'), ...rest];
  if (parts.length !== 8) return null;

  const hextets: number[] = [];
  for (const part of parts) {
    if (!/^[0-9a-f]{1,4}$/.test(part)) return null;
    hextets.push(parseInt(part, 16));
  }
  return hextets;
}

export function isBlockedAddress(address: string): boolean {
  const family = isIP(address);
  if (family === 4) return isBlockedIpv4Address(address);
  if (family !== 6) return true;

  const hextets = ipv6ToHextets(address);
  if (!hextets) return true;

  const firstFiveZero = hextets.slice(0, 5).every((part) => part === 0);
  // ::ffff:0:0/96 (IPv4-mapped) and ::/96 (IPv4-compatible) both carry an
  // IPv4 address in the last 32 bits, so apply the IPv4 policy to that
  // address. URL parsing rewrites [::ffff:127.0.0.1] to [::ffff:7f00:1],
  // which is why the dotted-quad form alone is not enough.
  if (firstFiveZero && (hextets[5] === 0xffff || hextets[5] === 0)) {
    return isBlockedIpv4Address(ipv4FromHextets(hextets[6], hextets[7]));
  }

  // 64:ff9b::/96, the well-known NAT64 prefix, embeds an IPv4 address.
  if (
    hextets[0] === 0x64 &&
    hextets[1] === 0xff9b &&
    hextets.slice(2, 6).every((part) => part === 0)
  ) {
    return isBlockedIpv4Address(ipv4FromHextets(hextets[6], hextets[7]));
  }

  if (hextets[0] === 0x64 && hextets[1] === 0xff9b && hextets[2] === 1) {
    return true; // 64:ff9b:1::/48 local-use NAT64
  }
  if (hextets[0] === 0x2002) {
    // 2002::/16 6to4 tunnels carry their IPv4 endpoint in bits 16-47.
    return isBlockedIpv4Address(ipv4FromHextets(hextets[1], hextets[2]));
  }
  if ((hextets[0] & 0xfe00) === 0xfc00) return true; // fc00::/7 unique local
  if ((hextets[0] & 0xffc0) === 0xfe80) return true; // fe80::/10 link-local
  if ((hextets[0] & 0xff00) === 0xff00) return true; // ff00::/8 multicast
  if (
    hextets[0] === 0x0100 &&
    hextets[1] === 0 &&
    hextets[2] === 0 &&
    hextets[3] === 0
  ) {
    return true; // 100::/64 discard-only
  }
  if (hextets[0] === 0x2001 && hextets[1] === 0x0db8) return true; // 2001:db8::/32 documentation
  if (hextets[0] === 0x2001 && (hextets[1] & 0xfff0) === 0x0010) return true; // 2001:10::/28 ORCHID
  if (hextets[0] === 0x2001 && (hextets[1] & 0xfff0) === 0x0020) return true; // 2001:20::/28 ORCHIDv2
  return false;
}

/**
 * Loopback addresses. The provider rule admits these directly; the scraping
 * rule refuses them.
 */
export function isLoopbackAddress(address: string): boolean {
  const family = isIP(address);
  if (family === 4) {
    return address.split('.')[0] === '127'; // 127.0.0.0/8
  }
  if (family !== 6) return false;

  const hextets = ipv6ToHextets(address);
  if (!hextets) return false;
  if (hextets.slice(0, 7).every((part) => part === 0) && hextets[7] === 1) {
    return true; // ::1
  }

  const firstFiveZero = hextets.slice(0, 5).every((part) => part === 0);
  if (firstFiveZero && (hextets[5] === 0xffff || hextets[5] === 0)) {
    // IPv4-mapped and IPv4-compatible addresses carry their payload in the
    // last 32 bits, so apply the IPv4 loopback rule to it.
    return isLoopbackAddress(ipv4FromHextets(hextets[6], hextets[7]));
  }
  return false;
}

/**
 * Every destination a provider base URL may use that a scraping target may
 * not: loopback and the private LAN ranges, including IPv4 addresses carried
 * inside an IPv6 literal.
 */
function isLocalNetworkAddress(address: string): boolean {
  if (isLoopbackAddress(address)) return true;
  const family = isIP(address);
  if (family === 4) return isPrivateLanIpv4Address(address);
  if (family !== 6) return false;

  const hextets = ipv6ToHextets(address);
  if (!hextets) return false;
  const firstFiveZero = hextets.slice(0, 5).every((part) => part === 0);
  if (firstFiveZero && (hextets[5] === 0xffff || hextets[5] === 0)) {
    return isPrivateLanIpv4Address(ipv4FromHextets(hextets[6], hextets[7]));
  }
  return false;
}

interface DestinationRules {
  /** Provider base URLs may name a service on the local host or LAN. */
  allowLocalNetwork: boolean;
  /** Reserved names that are accepted without a DNS lookup. */
  reservedHostnames: ReadonlySet<string>;
}

const EMPTY_HOSTNAMES: ReadonlySet<string> = new Set();

/** The provider endpoints the README documents for a Docker deployment. */
const PROVIDER_RESERVED_HOSTNAMES: ReadonlySet<string> = new Set([
  'localhost',
  'localhost.',
  'host.docker.internal',
  'host.docker.internal.',
]);

const PUBLIC_DESTINATIONS: DestinationRules = {
  allowLocalNetwork: false,
  reservedHostnames: EMPTY_HOSTNAMES,
};

const PROVIDER_BASE_URL_DESTINATIONS: DestinationRules = {
  allowLocalNetwork: true,
  reservedHostnames: PROVIDER_RESERVED_HOSTNAMES,
};

function isAllowedDestinationAddress(
  address: string,
  rules: DestinationRules,
): boolean {
  if (rules.allowLocalNetwork && isLocalNetworkAddress(address)) return true;
  return !isBlockedAddress(address);
}

async function assertUrlDestination(
  value: string,
  rules: DestinationRules,
  options: UrlPolicyOptions = {},
): Promise<URL> {
  let url: URL;
  try {
    url = new URL(value.trim());
  } catch {
    throw new Error(`unsupported URL: ${value}`);
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error(`unsupported URL scheme: ${url.protocol}`);
  }

  const host = url.hostname.replace(/^\[|\]$/g, '');
  if (host === '') throw new Error('the URL names no host');

  if (isIP(host)) {
    if (!isAllowedDestinationAddress(host, rules)) {
      throw new Error(
        `refusing a loopback, link-local or private destination: ${host}`,
      );
    }
    return url;
  }

  // The documented local provider names never need a resolver; letting them
  // through only for the provider rule keeps the scraping rule strict.
  if (rules.reservedHostnames.has(host.toLowerCase())) {
    return url;
  }

  const resolve = options.lookup ?? defaultLookup;
  let addresses: ResolvedAddress[];
  try {
    addresses = await resolve(host, { all: true, verbatim: true });
  } catch (error) {
    throw new Error(`could not resolve ${host}: ${(error as Error).message}`);
  }
  if (addresses.length === 0) throw new Error(`${host} did not resolve`);
  for (const entry of addresses) {
    if (!isAllowedDestinationAddress(entry.address, rules)) {
      throw new Error(
        `refusing a loopback, link-local or private destination: ${host} resolves to ${entry.address}`,
      );
    }
  }
  return url;
}

/**
 * Scraping rule: parse a URL and refuse it unless it is http(s), names a host
 * and every address that host resolves to is public.
 */
export async function assertPublicHttpUrl(
  value: string,
  options: UrlPolicyOptions = {},
): Promise<URL> {
  return assertUrlDestination(value, PUBLIC_DESTINATIONS, options);
}

/**
 * Provider rule: like the scraping rule, except loopback and private LAN
 * destinations are allowed because a self-hosted provider may run on this
 * host or on the local network.
 */
export async function assertProviderBaseUrl(
  value: string,
  options: UrlPolicyOptions = {},
): Promise<URL> {
  return assertUrlDestination(value, PROVIDER_BASE_URL_DESTINATIONS, options);
}

async function assertUrlField(
  value: unknown,
  assertUrl: (value: string, options: UrlPolicyOptions) => Promise<URL>,
  options: UrlPolicyOptions,
): Promise<void> {
  if (value === undefined) return;
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error('it must be a non-empty string');
  }
  await assertUrl(value, options);
}

/**
 * Validate a user-supplied baseURL field against the scraping rule. A present
 * value must be a non-empty string; a non-string value is rejected rather
 * than coerced, because provider parsing later calls String() on it.
 */
export async function assertPublicUrlField(
  value: unknown,
  options: UrlPolicyOptions = {},
): Promise<void> {
  await assertUrlField(value, assertPublicHttpUrl, options);
}

/**
 * Validate a user-supplied provider baseURL field against the provider rule,
 * which admits loopback and private LAN destinations.
 */
export async function assertProviderBaseUrlField(
  value: unknown,
  options: UrlPolicyOptions = {},
): Promise<void> {
  await assertUrlField(value, assertProviderBaseUrl, options);
}
