import SitePageHeader from "@/components/site/site-page-header";

export default function Code() {
  return (
    <div className="w-full flex flex-col items-start justify-start gap-4 py-4">
      <SitePageHeader title="code" />
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
    </div>
  );
}
