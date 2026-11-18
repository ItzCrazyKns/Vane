import { lookup } from 'node:dns/promises';
import { BlockList, isIP } from 'node:net';
import { request as httpRequest } from 'node:http';
import { request as httpsRequest } from 'node:https';

// Conservative public-address policy. Reject special-use ranges, including
// IPv4-mapped/transition IPv6, rather than relying on textual host checks.
const nonPublic = new BlockList();
for (const [address, prefix] of [
  ['0.0.0.0', 8],
  ['10.0.0.0', 8],
  ['100.64.0.0', 10],
  ['127.0.0.0', 8],
  ['169.254.0.0', 16],
  ['172.16.0.0', 12],
  ['192.0.0.0', 24],
  ['192.0.2.0', 24],
  ['192.88.99.0', 24],
  ['192.168.0.0', 16],
  ['198.18.0.0', 15],
  ['198.51.100.0', 24],
  ['203.0.113.0', 24],
  ['224.0.0.0', 3],
] as const)
  nonPublic.addSubnet(address, prefix, 'ipv4');
const globalV6 = new BlockList();
globalV6.addSubnet('2000::', 3, 'ipv6');
for (const [address, prefix] of [
  ['2001::', 23],
  ['2001:db8::', 32],
  ['2002::', 16],
  ['3fff::', 20],
] as const)
  nonPublic.addSubnet(address, prefix, 'ipv6');

const isPublicAddress = (address: string) => {
  const family = isIP(address);
  return family === 4
    ? !nonPublic.check(address, 'ipv4')
    : family === 6 &&
        globalV6.check(address, 'ipv6') &&
        !nonPublic.check(address, 'ipv6');
};

/** Desearch-only static HTML transport. No redirects, cookies, API credentials,
 * browser scripts, frames or subresources. Each fresh connection is pinned to
 * an address from the validated DNS answer, retaining the original TLS/Host name.
 */
export const fetchPublicHtml = async (value: string): Promise<string> => {
  try {
    const url = new URL(value);
    if (
      !['http:', 'https:'].includes(url.protocol) ||
      url.username ||
      url.password ||
      (url.port && url.port !== '80' && url.port !== '443')
    )
      throw new Error();
    const hostname = url.hostname.replace(/^\[|\]$/g, '').replace(/\.$/, '');
    const family = isIP(hostname);
    if (
      !family &&
      (!hostname.includes('.') ||
        /\.(localhost|local|internal|lan|home|corp|test|invalid|onion)$/i.test(
          hostname,
        ))
    ) {
      throw new Error();
    }
    const addresses = family
      ? [{ address: hostname, family }]
      : await lookup(hostname, { all: true, verbatim: true });
    if (
      !addresses.length ||
      addresses.some(({ address }) => !isPublicAddress(address))
    ) {
      throw new Error();
    }
    const pinned = addresses[0];
    return await new Promise<string>((resolve, reject) => {
      const transport = url.protocol === 'https:' ? httpsRequest : httpRequest;
      const req = transport(
        url,
        {
          agent: false,
          family: pinned.family,
          lookup: (_host, _options, callback) =>
            callback(null, pinned.address, pinned.family),
          headers: { Accept: 'text/html', 'Accept-Encoding': 'identity' },
          signal: AbortSignal.timeout(20000),
        },
        (response) => {
          // Node HTTP does not follow Location; reject every redirect explicitly.
          if (
            response.statusCode !== 200 ||
            !/^text\/html(?:;|$)/i.test(response.headers['content-type'] || '')
          ) {
            response.resume();
            reject(new Error());
            return;
          }
          const chunks: Buffer[] = [];
          let bytes = 0;
          response.on('data', (chunk: Buffer) => {
            bytes += chunk.length;
            if (bytes > 2 * 1024 * 1024) req.destroy(new Error());
            else chunks.push(chunk);
          });
          response.on('error', reject);
          response.on('aborted', () => reject(new Error()));
          response.on('end', () =>
            resolve(Buffer.concat(chunks).toString('utf8')),
          );
        },
      );
      req.on('error', reject);
      req.end();
    });
  } catch {
    throw new Error('Public page could not be retrieved');
  }
};
