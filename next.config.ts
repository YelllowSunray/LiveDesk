import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Prevent Turbopack from breaking firebase-admin on Vercel serverless.
  serverExternalPackages: ['firebase-admin', 'jose', 'jwks-rsa'],
  async headers() {
    return [
      {
        source: '/w/:path*',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: 'frame-ancestors *',
          },
        ],
      },
      {
        source: '/live/:path*',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: 'frame-ancestors *',
          },
        ],
      },
      {
        source: '/widget.js',
        headers: [
          {
            key: 'Access-Control-Allow-Origin',
            value: '*',
          },
          {
            key: 'Cache-Control',
            value: 'public, max-age=300',
          },
        ],
      },
    ];
  },
};

export default nextConfig;
