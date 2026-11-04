import test from 'node:test';
import assert from 'node:assert/strict';
import { isAllowedRequestUrl } from './requestUrl.ts';
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

test('subframe and subresource requests get the same destination policy', async () => {
  const allowed = [
    'https://public.example/app.js',
    'https://public.example/frame',
    'data:image/png;base64,AAAA',
    'blob:https://public.example/5f2c',
    'about:blank',
  ];
  for (const value of allowed) {
    assert.equal(
      await isAllowedRequestUrl(value, { lookup: publicLookup }),
      true,
      value,
    );
  }

  const blocked = [
    'http://127.0.0.1:8080/script.js',
    'http://10.0.0.1/logo.png',
    'http://169.254.169.254/latest/meta-data/',
    'http://[::ffff:127.0.0.1]/frame',
    'http://[::ffff:7f00:1]/frame',
    'https://missing.example/x.js',
  ];
  for (const value of blocked) {
    assert.equal(
      await isAllowedRequestUrl(value, { lookup: publicLookup }),
      false,
      value,
    );
  }
});

test('refuses WebSocket and every other non-http scheme', async () => {
  const blocked = [
    'ws://127.0.0.1:8080/socket',
    'ws://10.0.0.1/socket',
    'wss://public.example/socket',
    'wss://169.254.169.254/socket',
    'ftp://public.example/file',
    'file:///etc/passwd',
    'javascript:alert(1)',
    'chrome-extension://abc/page.html',
    '/just/a/path',
    '',
  ];
  for (const value of blocked) {
    assert.equal(
      await isAllowedRequestUrl(value, { lookup: publicLookup }),
      false,
      value,
    );
  }
});

test('allows public http and https requests', async () => {
  const allowed = [
    'https://public.example/',
    'https://public.example/path?q=1',
    'http://public.example/plain',
    'http://93.184.216.34/',
  ];
  for (const value of allowed) {
    assert.equal(
      await isAllowedRequestUrl(value, { lookup: publicLookup }),
      true,
      value,
    );
  }
});
