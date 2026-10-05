import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["three"],
  reactCompiler: true,
  redirects() {
    return [
      {
        source: "/sound/wave-player",
        destination: "/tech/audio",
        // The case-study destination may change in the planned site refresh.
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
