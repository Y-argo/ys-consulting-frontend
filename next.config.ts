import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: 'standalone',
  generateBuildId: async () => {
    return `build-${Date.now()}`;
  },
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: 'https://ys-consulting-api-cj2fjmijla-an.a.run.app/api/:path*',
      },
    ];
  },
  async headers() {
    return [
      {
        source: '/_next/static/:path*',
        headers: [
          { key: 'Cache-Control', value: 'no-store, no-cache, must-revalidate, proxy-revalidate' },
          { key: 'Pragma', value: 'no-cache' },
          { key: 'Expires', value: '0' },
        ],
      },
      {
        source: '/(.*)',
        headers: [
          { key: 'Cache-Control', value: 'no-store, no-cache, must-revalidate, proxy-revalidate' },
        ],
      },
    ];
  },
};

export default nextConfig;
