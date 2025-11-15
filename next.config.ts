import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["three"],
  reactCompiler: true,
  experimental: {
    viewTransition: true,
  },
};

export default nextConfig;
