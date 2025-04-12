import type { Metadata } from "next";
import SitePage from "@/components/site/site-page";

export const metadata: Metadata = {
  title: "tech",
};

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="w-fit text-xl leading-none font-mono font-semibold dark:font-medium bg-accent/30 border-l-2 border-accent-foreground/20 px-4 py-2">
      {children}
    </h2>
  );
}

export default function Tech() {
  return (
    <SitePage>
      <main className="size-full flex flex-col gap-10">
        {/* OVERVIEW SECTION */}
        {/* <section className="flex flex-col gap-3">
          <p className="text-sm font-mono">technology!</p>
        </section> */}
        {/* CODE SECTION */}
        <section className="flex flex-col gap-5">
          <SectionHeader>CODE</SectionHeader>
          <a
            href="https://github.com/kalynbeach"
            target="_blank"
            className="w-fit text-sm font-mono text-kb-blue dark:text-kb-green transition-colors duration-200 hover:text-blue-300 dark:hover:text-green-300"
          >
            github.com/kalynbeach
          </a>
        </section>
        {/* PROJECTS SECTION */}
        <section className="flex flex-col gap-5">
          <SectionHeader>PROJECTS</SectionHeader>
          <p className="text-sm font-mono">*under construction*</p>
        </section>
      </main>
    </SitePage>
  );
}
