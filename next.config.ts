import type { NextConfig } from "next";
import createMDX from "@next/mdx";

const nextConfig: NextConfig = {
  transpilePackages: ["three"],
  reactCompiler: true,
  redirects() {
    // tests/site.test.ts checks every destination here is a site map route.
    return [
      { source: "/tech", destination: "/software", permanent: false },
      {
        source: "/tech/audio",
        destination: "/software/kkb-audio",
        permanent: false,
      },
      {
        source: "/sound/wave-player",
        destination: "/software/kkb-audio",
        permanent: false,
      },
    ];
  },
};

export default createMDX()(nextConfig);
