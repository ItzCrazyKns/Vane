import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, statSync } from 'node:fs';
import { registerHooks } from 'node:module';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import type { NextRequest } from 'next/server';

// Next.js resolves the `@/` alias and extensionless imports at build time.
// Plain Node resolves neither, so the test installs the same rules for this
// process only. The model registry is replaced with an in-memory double so
// the route contract is exercised without writing data/config.json or
// contacting a provider server.
const srcRoot = path.resolve(import.meta.dirname, '../../..');
const projectRoot = path.dirname(srcRoot);

const fakeRegistryUrl = `data:text/javascript,${encodeURIComponent(`
export default class ModelRegistry {
  async addProvider(type, name, config) {
    return { id: 'provider-1', type, name, config };
  }

  async updateProvider(id, name, config) {
    return { id, type: 'ollama', name, config };
  }
}
`)}`;

function resolveSourceFile(base: string): string | null {
  for (const candidate of [
    base,
    `${base}.ts`,
    `${base}.tsx`,
    path.join(base, 'index.ts'),
    path.join(base, 'index.tsx'),
  ]) {
    if (existsSync(candidate) && statSync(candidate).isFile()) {
      return candidate;
    }
  }
  return null;
}

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === '@/lib/models/registry') {
      return { url: fakeRegistryUrl, shortCircuit: true };
    }
    if (specifier === 'next/server') {
      const server = path.join(projectRoot, 'node_modules/next/server.js');
      if (existsSync(server)) {
        return { url: pathToFileURL(server).href, shortCircuit: true };
      }
    }

    let base: string | null = null;
    if (specifier.startsWith('@/')) {
      base = path.join(srcRoot, specifier.slice(2));
    } else if (
      (specifier.startsWith('./') || specifier.startsWith('../')) &&
      context.parentURL?.startsWith('file:') &&
      path.extname(specifier) === ''
    ) {
      base = path.resolve(
        path.dirname(fileURLToPath(context.parentURL)),
        specifier,
      );
    }
    if (base) {
      const found = resolveSourceFile(base);
      if (found) {
        return { url: pathToFileURL(found).href, shortCircuit: true };
      }
    }
    return nextResolve(specifier, context);
  },
});

const providersRoute = await import('./route.ts');
const providerRoute = await import('./[id]/route.ts');

function jsonRequest(url: string, method: string, body: unknown): Request {
  return new Request(url, {
    method,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

test('POST /api/providers accepts an Ollama provider at http://localhost:11434', async () => {
  const response = await providersRoute.POST(
    jsonRequest('http://localhost/api/providers', 'POST', {
      type: 'ollama',
      name: 'Ollama',
      config: { baseURL: 'http://localhost:11434' },
    }) as unknown as NextRequest,
  );

  assert.equal(response.status, 200);
  const body = (await response.json()) as {
    provider: { config: { baseURL: string } };
  };
  assert.equal(body.provider.config.baseURL, 'http://localhost:11434');
});

test('PATCH /api/providers/[id] accepts a loopback base URL', async () => {
  const response = await providerRoute.PATCH(
    jsonRequest('http://localhost/api/providers/provider-1', 'PATCH', {
      name: 'Ollama',
      config: { baseURL: 'http://127.0.0.1:11434' },
    }) as unknown as NextRequest,
    { params: Promise.resolve({ id: 'provider-1' }) },
  );

  assert.equal(response.status, 200);
});

test('POST /api/providers accepts the documented Docker and LAN Ollama base URLs', async () => {
  for (const baseURL of [
    'http://host.docker.internal:11434',
    'http://10.0.0.5:11434',
    'http://192.168.1.10:11434',
  ]) {
    const response = await providersRoute.POST(
      jsonRequest('http://localhost/api/providers', 'POST', {
        type: 'ollama',
        name: 'Ollama',
        config: { baseURL },
      }) as unknown as NextRequest,
    );

    assert.equal(response.status, 200, baseURL);
    const body = (await response.json()) as {
      provider: { config: { baseURL: string } };
    };
    assert.equal(body.provider.config.baseURL, baseURL);
  }
});

test('PATCH /api/providers/[id] accepts a LAN base URL', async () => {
  const response = await providerRoute.PATCH(
    jsonRequest('http://localhost/api/providers/provider-1', 'PATCH', {
      name: 'Ollama',
      config: { baseURL: 'http://172.16.0.1:11434' },
    }) as unknown as NextRequest,
    { params: Promise.resolve({ id: 'provider-1' }) },
  );

  assert.equal(response.status, 200);
});

test('POST /api/providers still refuses a link-local base URL', async () => {
  const response = await providersRoute.POST(
    jsonRequest('http://localhost/api/providers', 'POST', {
      type: 'ollama',
      name: 'Ollama',
      config: { baseURL: 'http://169.254.169.254:11434' },
    }) as unknown as NextRequest,
  );

  assert.equal(response.status, 400);
  const body = (await response.json()) as { message: string };
  assert.match(body.message, /private destination/);
});

test('PATCH /api/providers/[id] still refuses a link-local base URL', async () => {
  const response = await providerRoute.PATCH(
    jsonRequest('http://localhost/api/providers/provider-1', 'PATCH', {
      name: 'Ollama',
      config: { baseURL: 'http://169.254.169.254:11434' },
    }) as unknown as NextRequest,
    { params: Promise.resolve({ id: 'provider-1' }) },
  );

  assert.equal(response.status, 400);
  const body = (await response.json()) as { message: string };
  assert.match(body.message, /private destination/);
});
