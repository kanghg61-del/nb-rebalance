import type { NextConfig } from 'next';
const config: NextConfig = {
  reactStrictMode: true,
  compress: true,
  poweredByHeader: false,
  serverExternalPackages: ['pg'],
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: true },
};
export default config;
