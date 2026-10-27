import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["three"],
  reactCompiler: true,
  redirects() {
    return [
      {
        source: "/sound/wave-player",
        // tests/site.test.ts checks every destination here is a site map route.
        destination: "/software/kkb-audio",
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
