import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    root: __dirname,
  },
  productionBrowserSourceMaps: true,
};

export default nextConfig;
