import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: false,
  allowedDevOrigins: ["127.0.0.1", "localhost"],
  productionBrowserSourceMaps: false,
  serverExternalPackages: [
    "@bryntum/scheduler",
    "@bryntum/scheduler-react",
    "@bryntum/gantt",
    "@bryntum/gantt-react",
    "ag-studio",
    "ag-studio-react",
    "@onkernel/sdk",
    "pg",
  ],
  webpack: (config) => {
    // Disable cache or memory-heavy source map generation in CI
    config.optimization = {
      ...config.optimization,
      minimize: true,
    };
    return config;
  },
};

export default nextConfig;
