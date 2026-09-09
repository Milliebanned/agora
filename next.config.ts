import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // @nimiq/core ships WebAssembly. Bundling it breaks the WASM loader, so it is
  // left as a real Node require in the serverless function.
  serverExternalPackages: ['@nimiq/core'],
  typescript: {
    ignoreBuildErrors: false,
  },
  eslint: {
    ignoreDuringBuilds: false,
  },
}

export default nextConfig
