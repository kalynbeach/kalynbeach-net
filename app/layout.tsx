import type { Metadata } from "next";
import localFont from "next/font/local";
import { Geist } from "next/font/google";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { Analytics } from "@vercel/analytics/react";
import { ClerkProvider } from "@clerk/nextjs";
import { shadcn } from "@clerk/ui/themes";
import { ViewTransition } from "react";
import { cn } from "@/lib/utils";
import ConvexClerkProvider from "@/components/providers/convex-clerk-provider";
import ThemeProvider from "@/components/site/theme-provider";
import SiteHeader from "@/components/site/site-header";
import SiteFooter from "@/components/site/site-footer";
import "./globals.css";

const berkeleyMono = localFont({
  src: "./TX-02-VF.woff2",
  variable: "--font-berkeley-mono",
});

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

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
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={cn(
          "relative font-sans antialiased",
          berkeleyMono.variable,
          geistSans.variable
        )}
      >
        <ClerkProvider appearance={{ theme: shadcn }}>
          <ConvexClerkProvider>
            <ThemeProvider
              attribute="class"
              defaultTheme="system"
              enableSystem
              disableTransitionOnChange
            >
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
