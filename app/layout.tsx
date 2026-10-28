import type { Metadata, Viewport } from "next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { Analytics } from "@vercel/analytics/react";
import { ClerkProvider } from "@clerk/nextjs";
import { shadcn } from "@clerk/ui/themes";
import { preload } from "react-dom";
import { api } from "@/convex/_generated/api";
import ConvexClerkProvider from "@/components/providers/convex-clerk-provider";
import { ThemeProvider } from "@/components/theme-provider";
import { SiteShell } from "@/components/site/shell";
import { LiveLookProvider } from "@/components/looks/live";
import { fetchPublicQuery } from "@/lib/convex/server";
import "./globals.css";

const fonts = [
  "/fonts/abc-areal/ABCArealVariable.woff2",
  "/fonts/departure-mono/DepartureMono-Regular.woff2",
  "/fonts/timeless-serif/TimelessSerifVF.woff2",
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

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  for (const href of fonts) {
    preload(href, { as: "font", type: "font/woff2", crossOrigin: "anonymous" });
  }

  // Both reads make every route render per request; see fetchPublicQuery.
  const [tracks, liveLook] = await Promise.all([
    fetchPublicQuery(api.tracks.list, {}, []),
    fetchPublicQuery(api.looks.live, {}, null),
  ]);

  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <ClerkProvider appearance={{ theme: shadcn }}>
          <ConvexClerkProvider>
            <ThemeProvider>
              <LiveLookProvider look={liveLook}>
                <SiteShell tracks={tracks}>{children}</SiteShell>
              </LiveLookProvider>
            </ThemeProvider>
            <Analytics />
            <SpeedInsights />
          </ConvexClerkProvider>
        </ClerkProvider>
      </body>
    </html>
  );
}
