import ThemeToggle from "./theme-toggle";

export default function SiteFooter() {
  return (
    <footer className="site-footer h-full min-h-16 flex flex-row items-center justify-end">
      {/* TODO: figure out what's causing ThemeToggle's DropdownMenu to break layout styles */}
      {/* <ThemeToggle /> */}
    </footer>
  );
}