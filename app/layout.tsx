import type { Metadata } from "next";
import localFont from "next/font/local";
import { Geist } from "next/font/google";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { Analytics } from "@vercel/analytics/react";
import { cn } from "@/lib/utils";
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
  title: "kalynbeach.net",
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
          "relative min-h-screen bg-background font-sans antialiased",
          berkeleyMono.variable,
          geistSans.variable,
        )}
      >
        <div className="container w-full min-h-screen grid grid-rows-layout-root md:grid-rows-layout-root-md">
          <ThemeProvider
            attribute="class"
            defaultTheme="system"
            enableSystem
            disableTransitionOnChange
          >
            <SiteHeader />
            {children}
            <SiteFooter />
          </ThemeProvider>
        </div>
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
