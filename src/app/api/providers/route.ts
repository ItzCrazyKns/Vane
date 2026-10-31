import ModelRegistry from '@/lib/models/registry';
import { NextRequest } from 'next/server';
import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';

export const GET = async (req: Request) => {
  try {
    const registry = new ModelRegistry();

    const activeProviders = await registry.getActiveProviders();

    const filteredProviders = activeProviders.filter((p) => {
      return !p.chatModels.some((m) => m.key === 'error');
    });

    return Response.json(
      {
        providers: filteredProviders,
      },
      {
        status: 200,
      },
    );
  } catch (err) {
    console.error('An error occurred while fetching providers', err);
    return Response.json(
      {
        message: 'An error has occurred.',
      },
      {
        status: 500,
      },
    );
  }
};

const BLOCKED_V4_RANGES: Array<[string, number]> = [
  ['0.0.0.0', 8],
  ['10.0.0.0', 8],
  ['100.64.0.0', 10],
  ['127.0.0.0', 8],
  ['169.254.0.0', 16],
  ['172.16.0.0', 12],
  ['192.0.0.0', 24],
  ['192.168.0.0', 16],
  ['198.18.0.0', 15],
  ['224.0.0.0', 4],
  ['240.0.0.0', 4],
];

function ipv4ToInt(address: string): number {
  return address
    .split('.')
    .reduce((acc, octet) => acc * 256 + Number(octet), 0) >>> 0;
}

/** Loopback, link-local, private, CGNAT, documentation and multicast space. */
function isPrivateAddress(address: string): boolean {
  if (isIP(address) === 4) {
    const value = ipv4ToInt(address);
    return BLOCKED_V4_RANGES.some(([base, bits]) => {
      const size = 2 ** (32 - bits);
      return value >= ipv4ToInt(base) && value < ipv4ToInt(base) + size;
    });
  }
  if (isIP(address) === 6) {
    const lower = address.toLowerCase();
    if (lower === '::' || lower === '::1') return true;
    const mapped = lower.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    if (mapped) return isPrivateAddress(mapped[1]);
    return (
      lower.startsWith('fc') ||
      lower.startsWith('fd') ||
      /^fe[89ab]/.test(lower) ||
      lower.startsWith('ff')
    );
  }
  return true;
}

/** A provider base URL the server may fetch: http(s) only, and every address
 *  the host resolves to is public. The stored baseURL is used on the next chat
 *  request, so a private destination is refused at creation. */
async function assertPublicProviderUrl(value: string): Promise<URL> {
  let url: URL;
  try {
    url = new URL(value.trim());
  } catch {
    throw new Error(`not a valid URL: ${value}`);
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error(`only http and https base URLs are allowed, not ${url.protocol}`);
  }
  const host = url.hostname.replace(/^\[|\]$/g, '');
  if (host === '') throw new Error('the base URL names no host');
  if (isIP(host)) {
    if (isPrivateAddress(host)) {
      throw new Error(`${host} is a loopback, link-local or private address`);
    }
    return url;
  }
  const addresses = await lookup(host, { all: true, verbatim: true });
  if (addresses.length === 0) throw new Error(`${host} did not resolve`);
  for (const entry of addresses) {
    if (isPrivateAddress(entry.address)) {
      throw new Error(
        `${host} resolves to ${entry.address}, a loopback, link-local or private address`,
      );
    }
  }
  return url;
}

export const POST = async (req: NextRequest) => {
  try {
    const body = await req.json();
    const { type, name, config } = body;

    if (!type || !name || !config) {
      return Response.json(
        {
          message: 'Missing required fields.',
        },
        {
          status: 400,
        },
      );
    }

    if (typeof config.baseURL === 'string' && config.baseURL.trim() !== '') {
      try {
        await assertPublicProviderUrl(config.baseURL);
      } catch (error) {
        return Response.json(
          {
            message: `Invalid provider base URL: ${(error as Error).message}`,
          },
          {
            status: 400,
          },
        );
      }
    }

    const registry = new ModelRegistry();

    const newProvider = await registry.addProvider(type, name, config);

    return Response.json(
      {
        provider: newProvider,
      },
      {
        status: 200,
      },
    );
  } catch (err) {
    console.error('An error occurred while creating provider', err);
    return Response.json(
      {
        message: 'An error has occurred.',
      },
      {
        status: 500,
      },
    );
  }
};
