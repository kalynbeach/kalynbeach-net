import type { Metadata } from "next";
import SitePageHeader from "@/components/site/site-page-header";

export const metadata: Metadata = {
  title: "about",
};

export default function About() {
  return (
    <div className="w-full flex flex-col items-start justify-start gap-4">
      <SitePageHeader />
      <main className="flex flex-col gap-4">
        <section className="flex flex-col gap-2">
          <p className="text-sm font-mono">thinking...</p>
        </section>
      </main>
    </div>
  );
}
