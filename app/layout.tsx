import type { Metadata } from "next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { Analytics } from "@vercel/analytics/react";
import { ClerkProvider } from "@clerk/nextjs";
import { shadcn } from "@clerk/ui/themes";
import { ViewTransition } from "react";
import { preload } from "react-dom";
import ConvexClerkProvider from "@/components/providers/convex-clerk-provider";
import { ThemeProvider } from "@/components/theme-provider";
import SiteHeader from "@/components/site/site-header";
import SiteFooter from "@/components/site/site-footer";
import "./globals.css";

const fonts = [
  "/fonts/abc-areal/ABCArealVariable.woff2",
  "/fonts/departure-mono/DepartureMono-Regular.woff2",
  "/fonts/paper-mono/PaperMono-Variable.woff2",
  "/fonts/timeless-serif/TimelessSerifVF.woff2",
];

export const metadata: Metadata = {
  title: {
    default: "kalynbeach.net",
    template: "%s | kalynbeach.net",
  },
  description: "kalynbeach",
};

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
      <body className="relative">
        <ClerkProvider appearance={{ theme: shadcn }}>
          <ConvexClerkProvider>
            <ThemeProvider>
              <ViewTransition name="root-layout">
                <div className="grid-rows-layout-root md:grid-rows-layout-root-md container grid size-full min-h-screen">
                  <SiteHeader />
                  {children}
                  <SiteFooter />
                </div>
              </ViewTransition>
            </ThemeProvider>
            <Analytics />
            <SpeedInsights />
          </ConvexClerkProvider>
        </ClerkProvider>
      </body>
    </html>
  );
}
