import pkg from './package.json' with { type: 'json' };

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  images: {
    remotePatterns: [
      {
        hostname: 's2.googleusercontent.com',
      },
    ],
  },
  serverExternalPackages: ['pdf-parse'],
  outputFileTracingIncludes: {
    '/api/**': [
      './node_modules/@napi-rs/canvas/**',
      './node_modules/@napi-rs/canvas-linux-x64-gnu/**',
      './node_modules/@napi-rs/canvas-linux-x64-musl/**',
      './node_modules/@napi-rs/canvas-linux-arm64-gnu/**',
      './node_modules/@napi-rs/canvas-linux-arm64-musl/**',
    ],
  },
  env: {
    NEXT_PUBLIC_VERSION: pkg.version,
  },
  async rewrites() {
    return [
      {
        source: '/v1/chat/completions',
        destination: '/api/openai/chat/completions',
      },
      {
        source: '/api/v1/chat/completions',
        destination: '/api/openai/chat/completions',
      },
      {
        source: '/chat/completions',
        destination: '/api/openai/chat/completions',
      },
    ];
  },
};

export default nextConfig;
