import type { Metadata } from "next";
import SitePage from "@/components/site/site-page";

export const metadata: Metadata = {
  title: "about",
};

export default function About() {
  return (
    <SitePage>
      <main className="size-full flex flex-col gap-4">
        <section className="flex flex-col gap-2">
          <p className="font-mono font-medium dark:font-normal">thinking...</p>
        </section>
      </main>
    </SitePage>
  );
}
