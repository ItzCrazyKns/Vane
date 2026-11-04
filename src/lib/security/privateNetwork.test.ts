import test from 'node:test';
import assert from 'node:assert/strict';
import {
  assertProviderBaseUrlField,
  assertPublicHttpUrl,
  assertPublicUrlField,
  isBlockedAddress,
  isBlockedIpv4Address,
} from './privateNetwork.ts';
import type { AddressLookup } from './privateNetwork.ts';

const lookupAnswers = (answers: Record<string, string[]>): AddressLookup => {
  return async (hostname) => {
    const addresses = answers[hostname];
    if (!addresses) throw new Error(`ENOTFOUND ${hostname}`);
    return addresses.map((address) => ({
      address,
      family: address.includes(':') ? 6 : 4,
    }));
  };
};

const publicLookup = lookupAnswers({ 'public.example': ['93.184.216.34'] });

test('refuses private IPv4 unicast, link-local, documentation and multicast space', () => {
  const blocked = [
    '0.0.0.0',
    '0.1.2.3',
    '10.0.0.1',
    '10.255.255.255',
    '100.64.0.1',
    '100.127.255.255',
    '127.0.0.1',
    '127.255.255.254',
    '169.254.169.254',
    '172.16.0.1',
    '172.31.255.255',
    '192.0.0.8',
    '192.0.2.10',
    '192.88.99.1',
    '192.168.1.1',
    '198.18.0.1',
    '198.19.255.255',
    '198.51.100.10',
    '203.0.113.10',
    '224.0.0.1',
    '239.255.255.255',
    '240.0.0.1',
    '255.255.255.255',
  ];
  for (const address of blocked) {
    assert.equal(isBlockedIpv4Address(address), true, address);
    assert.equal(isBlockedAddress(address), true, address);
  }
});

test('allows public IPv4 unicast space', () => {
  const allowed = ['1.1.1.1', '8.8.8.8', '93.184.216.34', '203.0.114.1'];
  for (const address of allowed) {
    assert.equal(isBlockedIpv4Address(address), false, address);
    assert.equal(isBlockedAddress(address), false, address);
  }
});

test('decodes IPv4-mapped IPv6 addresses before the range check', () => {
  // URL parsing rewrites [::ffff:127.0.0.1] to [::ffff:7f00:1].
  assert.equal(
    new URL('http://[::ffff:127.0.0.1]/').hostname,
    '[::ffff:7f00:1]',
  );

  const blocked = [
    '::ffff:127.0.0.1',
    '::ffff:7f00:1',
    '0:0:0:0:0:ffff:7f00:1',
    '::ffff:10.0.0.1',
    '::ffff:a00:1',
    '::ffff:192.168.1.1',
    '::ffff:c0a8:101',
    '::ffff:169.254.169.254',
    '::ffff:a9fe:a9fe',
  ];
  for (const address of blocked) {
    assert.equal(isBlockedAddress(address), true, address);
  }

  const allowed = ['::ffff:8.8.8.8', '::ffff:808:808', '::ffff:5db8:d822'];
  for (const address of allowed) {
    assert.equal(isBlockedAddress(address), false, address);
  }
});

test('decodes IPv4-compatible and NAT64 addresses before the range check', () => {
  assert.equal(isBlockedAddress('::7f00:1'), true);
  assert.equal(isBlockedAddress('::a00:1'), true);
  assert.equal(isBlockedAddress('::1'), true);
  assert.equal(isBlockedAddress('::'), true);
  assert.equal(isBlockedAddress('::808:808'), false);

  assert.equal(isBlockedAddress('64:ff9b::7f00:1'), true);
  assert.equal(isBlockedAddress('64:ff9b::a9fe:a9fe'), true);
  assert.equal(isBlockedAddress('64:ff9b::808:808'), false);
  assert.equal(isBlockedAddress('64:ff9b:1::1'), true);
});

test('refuses special-use and private IPv6 ranges', () => {
  const blocked = [
    'fc00::1',
    'fd12:3456:789a::1',
    'fe80::1',
    'febf::1',
    'ff02::1',
    '100::1',
    '2001:db8::1',
    '2001:10::1',
    '2001:20::1',
    '2002:7f00:1::1',
    '2002:a00:1::1',
  ];
  for (const address of blocked) {
    assert.equal(isBlockedAddress(address), true, address);
  }

  const allowed = [
    '2606:4700:4700::1111',
    '2001:4860:4860::8888',
    '2002:808:808::1',
  ];
  for (const address of allowed) {
    assert.equal(isBlockedAddress(address), false, address);
  }
});

test('fails closed on anything that is not an IP address', () => {
  for (const value of ['', 'localhost', 'example.com', '::zzzz', '1.2.3']) {
    assert.equal(isBlockedAddress(value), true, value);
  }
});

test('accepts http and https URLs whose host resolves only to public addresses', async () => {
  const url = await assertPublicHttpUrl('https://public.example/path', {
    lookup: publicLookup,
  });
  assert.equal(url.hostname, 'public.example');

  const literal = await assertPublicHttpUrl('http://8.8.8.8:8080/');
  assert.equal(literal.hostname, '8.8.8.8');
});

test('refuses non-http schemes and unparsable values', async () => {
  const rejected = [
    'ftp://public.example/file',
    'file:///etc/passwd',
    'javascript:alert(1)',
    '/just/a/path',
    '',
  ];
  for (const value of rejected) {
    await assert.rejects(assertPublicHttpUrl(value, { lookup: publicLookup }));
  }
});

test('refuses private URL literals, including IPv4-mapped IPv6 literals', async () => {
  const rejected = [
    'http://127.0.0.1/',
    'http://127.1/',
    'http://0177.0.0.1/',
    'http://2130706433/',
    'http://0x7f000001/',
    'http://[::1]/',
    'http://[::ffff:127.0.0.1]/',
    'http://[::ffff:7f00:1]/',
    'http://10.0.0.5/',
    'http://169.254.169.254/latest/meta-data/',
    'http://192.168.1.1/',
    'http://[fd00::1]/',
    'http://192.0.2.10/',
    'http://198.51.100.10/',
    'http://203.0.113.10/',
    'http://[2001:db8::1]/',
  ];
  for (const value of rejected) {
    await assert.rejects(
      assertPublicHttpUrl(value, { lookup: publicLookup }),
      Error,
      value,
    );
  }
});

test('refuses a hostname when any resolved address is private', async () => {
  const mixedLookup = lookupAnswers({
    'mixed.example': ['93.184.216.34', '10.0.0.1'],
  });
  await assert.rejects(
    assertPublicHttpUrl('https://mixed.example/', { lookup: mixedLookup }),
    /private destination/,
  );

  const privateLookup = lookupAnswers({ 'internal.example': ['127.0.0.1'] });
  await assert.rejects(
    assertPublicHttpUrl('https://internal.example/', {
      lookup: privateLookup,
    }),
    /private destination/,
  );

  const mappedLookup = lookupAnswers({ 'mapped.example': ['::ffff:7f00:1'] });
  await assert.rejects(
    assertPublicHttpUrl('https://mapped.example/', { lookup: mappedLookup }),
    /private destination/,
  );
});

test('a present baseURL field must be a non-empty string', async () => {
  await assert.doesNotReject(assertPublicUrlField(undefined));
  for (const value of [null, 42, true, {}, [], '', '   ']) {
    await assert.rejects(
      assertPublicUrlField(value, { lookup: publicLookup }),
      /non-empty string/,
      JSON.stringify(value),
    );
  }
  await assert.doesNotReject(
    assertPublicUrlField('https://public.example/v1', { lookup: publicLookup }),
  );
  await assert.rejects(
    assertPublicUrlField('http://127.0.0.1:11434/api', {
      lookup: publicLookup,
    }),
    /private destination/,
  );
});

test('provider base URLs accept loopback destinations', async () => {
  const loopback = [
    'http://127.0.0.1:11434',
    'http://127.1.2.3:11434/api',
    'http://127.255.255.254:11434',
    'http://[::1]:11434',
    'http://[::ffff:127.0.0.1]:11434',
    'http://[::ffff:7f00:1]:11434',
    'http://localhost:11434',
    'http://localhost.:1234/v1',
  ];
  for (const value of loopback) {
    await assertProviderBaseUrlField(value, { lookup: publicLookup });
  }
  await assertProviderBaseUrlField('https://public.example/v1', {
    lookup: publicLookup,
  });
});

test('provider base URLs accept the documented Docker and LAN endpoints', async () => {
  const local = [
    'http://host.docker.internal:11434',
    'http://host.docker.internal.:11434/v1',
    'http://10.0.0.5:11434',
    'http://10.255.255.254:11434',
    'http://172.16.0.1:11434',
    'http://172.31.255.255:11434',
    'http://192.168.1.10:11434',
    'http://192.168.255.255:11434',
    'http://[::ffff:10.0.0.5]:11434',
    'http://[::ffff:192.168.1.10]:11434',
  ];
  for (const value of local) {
    await assertProviderBaseUrlField(value, { lookup: publicLookup });
  }

  // A LAN hostname is the same destination as the private address it
  // resolves to.
  await assertProviderBaseUrlField('http://ollama.lan:11434', {
    lookup: lookupAnswers({ 'ollama.lan': ['192.168.1.20'] }),
  });
  await assertProviderBaseUrlField('http://private.example/v1', {
    lookup: lookupAnswers({ 'private.example': ['10.0.0.1'] }),
  });

  // The scraping rule is unchanged: a page must not reach the LAN either.
  for (const value of ['http://10.0.0.5:11434', 'http://192.168.1.10:11434']) {
    await assert.rejects(
      assertPublicUrlField(value, { lookup: publicLookup }),
      /private destination/,
      value,
    );
  }
});

test('the provider base URL rule still refuses the other blocked destinations', async () => {
  const blocked = [
    'http://0.0.0.0:11434',
    'http://100.64.0.1:11434',
    'http://169.254.169.254/latest/meta-data/',
    'http://[fd00::1]:11434',
    'http://[fe80::1]:11434',
    'http://[::ffff:169.254.169.254]:11434',
  ];
  for (const value of blocked) {
    await assert.rejects(
      assertProviderBaseUrlField(value, { lookup: publicLookup }),
      /private destination/,
      value,
    );
  }

  // A hostname that resolves to a still-blocked destination stays refused.
  await assert.rejects(
    assertProviderBaseUrlField('http://metadata.example/v1', {
      lookup: lookupAnswers({ 'metadata.example': ['169.254.169.254'] }),
    }),
    /private destination/,
  );

  // The scraping rule is unchanged: the same loopback address is refused
  // there because a page must not be able to reach a service on this host.
  await assert.rejects(
    assertPublicUrlField('http://127.0.0.1:11434', {
      lookup: publicLookup,
    }),
    /private destination/,
  );
  await assert.rejects(
    assertPublicHttpUrl('http://localhost:11434', {
      lookup: lookupAnswers({ localhost: ['::1'] }),
    }),
    /private destination/,
  );
});

test('the provider base URL rule refuses each remaining reserved range', async (t) => {
  const refused: ReadonlyArray<readonly [string, string]> = [
    ['0.0.0.0/8 this network', 'http://0.1.2.3:11434'],
    ['100.64.0.0/10 carrier-grade NAT', 'http://100.64.0.1:11434'],
    ['169.254.0.0/16 link-local', 'http://169.254.169.254/latest/meta-data/'],
    ['192.0.0.0/24 protocol assignments', 'http://192.0.0.8:11434'],
    ['192.0.2.0/24 TEST-NET-1', 'http://192.0.2.10:11434'],
    ['192.88.99.0/24 6to4 relay anycast', 'http://192.88.99.1:11434'],
    ['198.18.0.0/15 benchmarking', 'http://198.18.0.1:11434'],
    ['198.51.100.0/24 TEST-NET-2', 'http://198.51.100.10:11434'],
    ['203.0.113.0/24 TEST-NET-3', 'http://203.0.113.10:11434'],
    ['224.0.0.0/4 multicast', 'http://224.0.0.1:11434'],
    ['240.0.0.0/4 reserved', 'http://240.0.0.1:11434'],
    ['fc00::/7 unique local', 'http://[fd00::1]:11434'],
    ['fe80::/10 link-local', 'http://[fe80::1]:11434'],
    ['ff00::/8 multicast', 'http://[ff02::1]:11434'],
    ['100::/64 discard-only', 'http://[100::1]:11434'],
    ['2001:db8::/32 documentation', 'http://[2001:db8::1]:11434'],
    ['64:ff9b:1::/48 local NAT64', 'http://[64:ff9b:1::1]:11434'],
    ['2001:10::/28 ORCHID', 'http://[2001:10::1]:11434'],
    ['2001:20::/28 ORCHIDv2', 'http://[2001:20::1]:11434'],
    [
      '2002::/16 with a private IPv4 endpoint',
      'http://[2002:c0a8:101::1]:11434',
    ],
  ];
  for (const [range, value] of refused) {
    await t.test(range, async () => {
      await assert.rejects(
        assertProviderBaseUrlField(value, { lookup: publicLookup }),
        /private destination/,
        value,
      );
    });
  }
});

test('refuses a hostname that does not resolve', async () => {
  await assert.rejects(
    assertPublicHttpUrl('https://missing.example/', {
      lookup: lookupAnswers({}),
    }),
    /could not resolve/,
  );
  await assert.rejects(
    assertPublicHttpUrl('https://empty.example/', {
      lookup: lookupAnswers({ 'empty.example': [] }),
    }),
    /did not resolve/,
  );
});
