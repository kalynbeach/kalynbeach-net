"use client";

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
        <DrawerTrigger className="">
          <Menu className="w-5 h-5" />
        </DrawerTrigger>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle className="font-mono">🌐</DrawerTitle>
            <DrawerDescription className="font-mono"></DrawerDescription>
          </DrawerHeader>
          <div className="flex flex-col justify-center gap-2 p-4">
            {pages.map((page) => (
              <SiteNavLink
                key={page.route}
                page={page}
                isActive={pathname === page.route}
                onClick={() => setOpen(false)}
              />
            ))}
          </div>
          <DrawerFooter>
            {/* <Button>Submit</Button> */}
            {/* <DrawerClose>
              <Button variant="outline">Cancel</Button>
            </DrawerClose> */}
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    </div>
  );
}