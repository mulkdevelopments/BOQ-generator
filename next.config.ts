import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ['pdf-parse', 'better-sqlite3', '@mlightcad/libredwg-web'],
  turbopack: {},
  // Increase body size limit for large file uploads
  experimental: {
    serverActions: {
      bodySizeLimit: '500mb',
    },
  },
};

export default nextConfig;
