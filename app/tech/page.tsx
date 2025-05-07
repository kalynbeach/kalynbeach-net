import type { Metadata } from "next";
import SitePage from "@/components/site/site-page";

export const metadata: Metadata = {
  title: "tech",
};

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="w-fit text-xl leading-none font-mono font-semibold dark:font-medium py-1">
      {`» `}{children}
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
        <section className="flex flex-col gap-4">
          <SectionHeader>CODE</SectionHeader>
          <a
            href="https://github.com/kalynbeach"
            target="_blank"
            className="w-fit text-sm font-mono text-secondary-foreground underline underline-offset-2 decoration-accent dark:decoration-muted-foreground transition duration-150 hover:text-kb-blue hover:decoration-kb-blue/50 dark:hover:text-kb-green dark:hover:decoration-kb-green/50"
          >
            github.com/kalynbeach
          </a>
        </section>
        {/* PROJECTS SECTION */}
        {/* <section className="flex flex-col gap-4">
          <SectionHeader>PROJECTS</SectionHeader>
          <p className="text-sm font-mono">*under construction*</p>
        </section> */}
      </main>
    </SitePage>
  );
}
