"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import type { SitePage } from "@/lib/types";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command";

type SiteCommandMenuProps = {
  pages: SitePage[];
};

export default function SiteCommandMenu({ pages }: SiteCommandMenuProps) {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  function navigateToPage(page: SitePage) {
    setOpen(false);
    router.push(page.route);
  }

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((open) => !open);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  return (
    <div className="site-command-menu hidden sm:block">
      <p className="font-mono font-medium text-xs text-muted-foreground leading-none">
        <kbd className="font-mono font-medium text-xs text-muted-foreground leading-non h-5 pointer-events-none select-none inline-flex flex-row justify-center items-center gap-0.5 border border-muted bg-muted/30 px-1 opacity-100">
          <span className="text-xs">⌘</span>K
        </kbd>
      </p>
      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput placeholder="Type a command or search..." />
        <CommandList>
          <CommandEmpty>No results found.</CommandEmpty>
          <PagesCommandGroup pages={pages} handler={navigateToPage} />
        </CommandList>
      </CommandDialog>
    </div>
  );
}

function PagesCommandGroup({ pages, handler }: { pages: SitePage[], handler: (page: SitePage) => void}) {
  return (
    <CommandGroup heading="pages" className="p-2">
      {pages.map((page) => (
        <CommandItem
          key={page.label}
          onSelect={() => handler(page)}
          className="font-mono rounded-md"
        >
          {page.label}
        </CommandItem>
      ))}
    </CommandGroup>
  );
};