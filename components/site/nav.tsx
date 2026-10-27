"use client";

/**
 * Section 2's parts and the nav sheet. The shell passes the rows it resolved,
 * so the nav never reads the pathname to decide active state.
 */
import Link from "next/link";
import { useState } from "react";
import { usePathname } from "next/navigation";
import { Drawer } from "@base-ui/react/drawer";
import { cn } from "@/lib/utils";
import { siteName, type NavRow } from "@/lib/site";
import { Waveform } from "@/components/waveform";

/**
 * "Kalyn Beach" and the mark. `row` is section 2's 52px header row, with the
 * mark in the same column as the active dot. `inline` sits in the mobile top
 * bar and the sheet header. `atRest` shows the 3x3 beam (Home).
 */
export function Identity({
  layout,
  atRest,
}: {
  layout: "row" | "inline";
  atRest: boolean;
}) {
  return (
    <div
      data-slot="site-identity"
      className={
        layout === "row"
          ? "h-header flex items-center justify-between gap-3 pr-6 pl-5"
          : "flex items-center gap-3"
      }
    >
      <Link href="/" data-slot="site-name" className="role-name text-ramp-10">
        {siteName}
      </Link>
      <span className="size-5.25">
        <Waveform form="mark" atRest={atRest} />
      </span>
    </div>
  );
}

const rowColor = {
  idle: "text-ramp-7 hover:text-ramp-9",
  active: "text-ramp-10",
  ancestor: "text-ramp-9",
} as const satisfies Record<NavRow["state"], string>;

/**
 * The nav list: padding 12 top, 20 inline, 20 bottom. Every row is a 32px
 * link with the dot at its right end, 12 in from the edge, so on desktop the
 * dot lines up with the mark at both depths.
 */
export function NavTree({
  rows,
  onNavigate,
}: {
  rows: readonly NavRow[];
  onNavigate?: () => void;
}) {
  return (
    <ul className="px-5 pt-3 pb-5">
      {rows.map((row) => (
        <NavItem key={row.label} row={row} onNavigate={onNavigate} />
      ))}
    </ul>
  );
}

function NavItem({
  row,
  onNavigate,
}: {
  row: NavRow;
  onNavigate?: () => void;
}) {
  return (
    <li>
      <Link
        href={row.href}
        onClick={onNavigate}
        aria-current={row.state === "active" ? "page" : undefined}
        className={cn(
          "role-nav flex h-row items-center justify-between pr-3",
          rowColor[row.state]
        )}
      >
        {row.label}
        {row.state === "active" && (
          <span
            data-slot="nav-dot"
            aria-hidden
            className="bg-signal shadow-lit-dot size-1.25"
          />
        )}
      </Link>
      {row.rows.length > 0 && (
        <ul className="pl-3">
          {row.rows.map((child) => (
            <NavItem key={child.label} row={child} onNavigate={onNavigate} />
          ))}
        </ul>
      )}
    </li>
  );
}

/**
 * Below 1100px: the menu button and the sheet it slides in from the left.
 * Escape, a backdrop click, a link click and any navigation close it.
 *
 * Built on Base UI's Drawer directly. The registry's DrawerContent always
 * renders a dithered, blurred overlay; R7 wants a plain backdrop of
 * --background at 72%.
 */
export function NavSheet({
  rows,
  atRest,
}: {
  rows: readonly NavRow[];
  atRest: boolean;
}) {
  const pathname = usePathname();
  // The sheet remembers the path it opened on and is open only while that
  // path is current, so a navigation closes it with no effect.
  const [openOn, setOpenOn] = useState<string | null>(null);
  const close = () => setOpenOn(null);

  return (
    <Drawer.Root
      open={openOn === pathname}
      onOpenChange={(open) => setOpenOn(open ? pathname : null)}
      swipeDirection="left"
    >
      <Drawer.Trigger
        aria-label="Open navigation"
        className="flex size-10 flex-col justify-center gap-1.25 px-2.5"
      >
        <span className="bg-ramp-9 h-px w-5" />
        <span className="bg-ramp-9 h-px w-5" />
        <span className="bg-ramp-9 h-px w-3" />
      </Drawer.Trigger>
      <Drawer.Portal>
        <Drawer.Backdrop className="bg-background/72 fixed inset-0 transition-opacity duration-(--duration-large) ease-out data-ending-style:opacity-0 data-starting-style:opacity-0" />
        <Drawer.Viewport className="fixed inset-0">
          <Drawer.Popup
            data-slot="nav-sheet"
            className="top-safe-top bottom-safe-bottom left-edge w-sheet bg-background fixed flex translate-x-(--drawer-swipe-movement-x) flex-col transition-transform duration-(--duration-large) ease-out data-ending-style:-translate-x-full data-starting-style:-translate-x-full data-swiping:duration-0"
          >
            <Drawer.Title className="sr-only">Navigation</Drawer.Title>
            <div
              data-slot="sheet-header"
              className="h-header flex items-center justify-between pr-3 pl-5"
            >
              <Identity layout="inline" atRest={atRest} />
              <Drawer.Close
                aria-label="Close navigation"
                className="text-ramp-9 grid size-10 place-items-center"
              >
                <svg aria-hidden viewBox="0 0 14 14" className="size-3.5">
                  <path
                    d="M2 2l10 10M12 2L2 12"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={1.25}
                  />
                </svg>
              </Drawer.Close>
            </div>
            <nav data-slot="site-nav" aria-label="Site">
              <NavTree rows={rows} onNavigate={close} />
            </nav>
          </Drawer.Popup>
        </Drawer.Viewport>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
