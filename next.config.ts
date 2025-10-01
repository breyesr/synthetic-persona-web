// next.config.ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  eslint: {
    // Don’t block the production build on ESLint errors
    ignoreDuringBuilds: true,
  },
  typescript: {
    // Don’t block the production build on TS type errors
    ignoreBuildErrors: true,
  },
};

export default nextConfig;