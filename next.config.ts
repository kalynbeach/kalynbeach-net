import type { NextConfig } from "next";
import createMDX from "@next/mdx";

const nextConfig: NextConfig = {
  reactCompiler: true,
  // lib/site.ts reads this to serve only published pages and drop <Draft>
  // sections. Next inlines it into the server and client bundles.
  env: {
    SITE_PUBLISHED_ONLY:
      process.env.VERCEL_ENV === "production" ? "true" : "false",
  },
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
