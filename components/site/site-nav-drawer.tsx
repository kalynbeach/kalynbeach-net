"use client";

import Link from "next/link";
import { useState } from "react";
import { usePathname } from "next/navigation";
import type { SitePage } from "@/lib/types";
import SiteNavLink from "./site-nav-link";
import { Menu } from "lucide-react";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";

type SiteNavDrawerProps = {
  pages: SitePage[];
};

export default function SiteNavDrawer({ pages }: SiteNavDrawerProps) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  return (
    <div className="site-nav-drawer flex flex-row items-center justify-center sm:hidden">
      <Drawer open={open} onOpenChange={setOpen} direction="right">
        <DrawerTrigger>
          <Menu className="w-5 h-5" />
        </DrawerTrigger>
        <DrawerContent className="border border-l-secondary">
          <DrawerHeader>
            <DrawerTitle>
              <Link href="/" className="text-lg font-mono font-medium">
                kalynbeach
              </Link>
            </DrawerTitle>
            <DrawerDescription className="font-mono"></DrawerDescription>
          </DrawerHeader>
          <div className="flex flex-col justify-center gap-3 p-4">
            {pages.slice(1).map((page) => (
              <SiteNavLink
                key={page.route}
                page={page}
                isActive={pathname.includes(page.route)}
                onClick={() => setOpen(false)}
              />
            ))}
          </div>
          <DrawerFooter></DrawerFooter>
        </DrawerContent>
      </Drawer>
    </div>
  );
}