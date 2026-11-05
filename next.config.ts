import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: false,
  allowedDevOrigins: ["127.0.0.1", "localhost"],
  transpilePackages: [
    "@bryntum/scheduler",
    "@bryntum/scheduler-react",
    "@bryntum/gantt",
    "@bryntum/gantt-react",
  ],
};

export default nextConfig;

