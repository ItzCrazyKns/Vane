import path from 'node:path';
import pkg from './package.json' with { type: 'json' };
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

/* yarn installs both the glibc (gnu) and musl builds of @napi-rs/canvas on
 * Linux. Trace only the one matching the libc of the build machine, which is
 * also the runtime (the Docker images build and run on the same base). */
const canvasLibc = process.report?.getReport?.().header?.glibcVersionRuntime
  ? 'gnu'
  : 'musl';

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  /* The build type-checks only the app. Tests (checked by `tsc --noEmit`
   * and Vitest) import fixtures from perf-audit/, which is not in the
   * Docker build context. */
  typescript: {
    tsconfigPath: 'tsconfig.build.json',
  },
  serverExternalPackages: ['pdf-parse', 'officeparser', 'file-type'],
  outputFileTracingIncludes: {
    '/api/**': [
      './node_modules/@napi-rs/canvas/**',
      `./node_modules/@napi-rs/canvas-linux-*-${canvasLibc}/**`,
    ],
  },
  env: {
    NEXT_PUBLIC_VERSION: pkg.version,
  },
  turbopack: {
    root: process.cwd(),
  },
};

export default withNextIntl(nextConfig);
