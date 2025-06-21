import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [new URL('https://covers.openlibrary.org/**')],
  },
}

export default nextConfig
