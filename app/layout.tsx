import type { Metadata, Viewport } from "next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { Analytics } from "@vercel/analytics/next";
import { ClerkProvider } from "@clerk/nextjs";
import { shadcn } from "@clerk/ui/themes";
import { Suspense } from "react";
import { preload } from "react-dom";
import { api } from "@/convex/_generated/api";
import ConvexClerkProvider from "@/components/providers/convex-clerk-provider";
import { ThemeProvider } from "@/components/theme-provider";
import { SiteShell } from "@/components/site/shell";
import { Seed } from "@/components/site/seed";
import { fetchPublicQuery } from "@/lib/convex/server";
import "./globals.css";

// Every page sets text in these two. Departure Mono loads on use, since no
// page text sets in it; only installed Kevelle parts, such as the player's
// readouts, draw it.
const fonts = [
  "/fonts/abc-areal/ABCArealVariable.woff2",
  "/fonts/tx-02/TX-02-Variable.woff2",
];

export const metadata: Metadata = {
  title: {
    default: "kalynbeach.net",
    template: "%s | kalynbeach.net",
  },
  description: "kalynbeach",
};

/** cover lets the mobile top bar, sheet and player bar use the safe-area insets. */
export const viewport: Viewport = { viewportFit: "cover" };

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  for (const href of fonts) {
    preload(href, { as: "font", type: "font/woff2", crossOrigin: "anonymous" });
  }

  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <ClerkProvider appearance={{ theme: shadcn }}>
          <ConvexClerkProvider>
            <ThemeProvider>
              <SiteShell
                seed={
                  <Suspense fallback={null}>
                    <LiveSeed />
                  </Suspense>
                }
              >
                {children}
              </SiteShell>
            </ThemeProvider>
            <Analytics />
            <SpeedInsights />
          </ConvexClerkProvider>
        </ClerkProvider>
      </body>
    </html>
  );
}

/**
 * The two Convex reads the shell's player and waveform start from. The
 * layout renders it in its own <Suspense>, so every page's HTML goes out
 * without waiting on Convex and the reads stream in behind it. They render
 * per request; see fetchPublicQuery.
 */
async function LiveSeed() {
  const [tracks, liveLook] = await Promise.all([
    fetchPublicQuery(api.tracks.list, {}, []),
    fetchPublicQuery(api.looks.live, {}, null),
  ]);

  return <Seed tracks={tracks} liveLook={liveLook} />;
}
