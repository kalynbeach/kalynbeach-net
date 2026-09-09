import SiteFooterLogo from "@/components/site/site-footer-logo";
// import ThemeToggle from "./theme-toggle";

export default function SiteFooter() {
  return (
    <footer className="site-footer flex h-full min-h-16 flex-row items-center justify-center">
      <SiteFooterLogo />
      {/* <ThemeToggle /> */}
    </footer>
  );
}
