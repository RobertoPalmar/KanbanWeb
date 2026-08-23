import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  reactStrictMode: true,
  experimental: {
    // Las server actions reciben adjuntos de hasta 25 MB (MAX_ATTACHMENT_BYTES).
    serverActions: { bodySizeLimit: '26mb' },
  },
}

export default nextConfig
