/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  experimental: {
    serverActions: {
      bodySizeLimit: '512mb',
    },
    // instrumentationHook: true, // NOT NECESSARY ANYMORE!
  },
  output: 'standalone',
}

export default nextConfig
