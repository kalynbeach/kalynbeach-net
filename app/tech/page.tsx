import SitePageHeader from "@/components/site/site-page-header";

export default function Tech() {
  return (
    <div className="w-full flex flex-col items-start justify-start gap-4 py-4">
      <SitePageHeader title="tech" />
      <main className="flex flex-col gap-4">
        {/* TODO: Tech Overview */}
        {/* <section className="flex flex-col gap-2">
          <p className="text-sm font-mono">technology!</p>
        </section> */}
        <section className="flex flex-col gap-2">
          <h2 className="text-xl font-mono font-medium">CODE</h2>
          {/* GitHub Info */}
          <div className="flex flex-col gap-3">
            <a
              href="https://github.com/kalynbeach"
              target="_blank"
              className="font-mono text-sm text-kb-blue dark:text-kb-green transition-colors duration-200 hover:text-blue-300 dark:hover:text-green-300"
            >
              github.com/kalynbeach
            </a>
          </div>
          {/* TODO: Code project card grid */}
          {/* <div className="flex flex-col gap-3">
            <h3 className="text-lg font-mono">PROJECTS</h3>
          </div> */}
        </section>
        {/* TODO: Work section content */}
        {/* <section className="">
          <h2 className="text-xl font-mono font-medium">WORK</h2>
        </section> */}
      </main>
    </div>
  );
}
