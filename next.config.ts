import type { NextConfig } from "next";
import createMDX from "@next/mdx";

const nextConfig: NextConfig = {
  reactCompiler: true,
  // "Open image in new tab" shows optimizer images, such as screenshot.tsx's,
  // instead of downloading them. The attachment default guards SVGs, which
  // can't reach the optimizer here without dangerouslyAllowSVG.
  images: { contentDispositionType: "inline" },
  turbopack: {
    // Strips a `?metadata` import of an MDX file to its metadata export.
    // Turbopack runs every matching rule in order, and @next/mdx adds its
    // own rule after this one, so it compiles the stripped source.
    rules: {
      "*.mdx": {
        condition: { query: "?metadata" },
        loaders: ["./tools/mdx/metadata-loader.ts"],
      },
    },
  },
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
