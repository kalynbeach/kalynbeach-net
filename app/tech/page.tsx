import type { Metadata } from "next";
import SitePage from "@/components/site/site-page";

export const metadata: Metadata = {
  title: "tech",
};

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="w-fit py-1 font-mono text-xl leading-none font-semibold dark:font-medium">
      {`» `}
      {children}
    </h2>
  );
}

export default function Tech() {
  return (
    <SitePage>
      <main className="flex size-full flex-col gap-10">
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
            className="text-secondary-foreground decoration-accent dark:decoration-muted-foreground hover:text-kb-blue hover:decoration-kb-blue/50 dark:hover:text-kb-green dark:hover:decoration-kb-green/50 w-fit font-mono text-sm underline underline-offset-2 transition duration-150"
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
