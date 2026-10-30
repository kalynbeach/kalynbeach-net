"use client";

/**
 * The sidebar's parts and the nav sheet. The shell passes the rows it
 * resolved, so the nav never reads the pathname to decide active state.
 */
import Link from "next/link";
import { useState } from "react";
import { usePathname } from "next/navigation";
import { Drawer } from "@base-ui/react/drawer";
import { cn } from "@/lib/utils";
import { siteName, type NavRow } from "@/lib/site";
import type { Layout } from "@/lib/layout";
import { Waveform } from "@/components/waveform/waveform";

/**
 * "Kalyn Beach" with the mark, the static waveform, right of it, at the top
 * of the sidebar, in the mobile top bar and in the sheet header. The mark's
 * box always renders, so the row keeps its size. The shell sets `mark` on
 * the one Identity its layout shows (none on Home), since the waveform lends
 * its view-transition name to the newest mark even when CSS hides it. Below
 * 1100px the open sheet's Identity is the newest, so it holds the name while
 * the sheet covers the top bar.
 *
 * role-name trims the name to its caps, so the row's top is the name's cap
 * top: the top line in the sidebar. The mark's negative block margins keep
 * it from setting the row's height, and it centers on the caps. The trimmed
 * box ends at the baseline, so the name's focus ring sits 4px out to clear
 * the descender of the y.
 */
export function Identity({ mark }: { mark: boolean }) {
  return (
    <div data-slot="site-identity" className="flex items-center gap-3">
      <Link
        href="/"
        data-slot="site-name"
        className="role-name text-ramp-10 focus-visible:outline-2 focus-visible:outline-offset-4"
      >
        {siteName}
      </Link>
      <span className="-my-2 size-5.25">
        {mark && <Waveform form="mark" className="size-full" />}
      </span>
    </div>
  );
}

/**
 * Text color alone marks the active row. The parent of the active page stays
 * idle-colored, so one row reads as active.
 */
const rowColor = {
  idle: "text-nav-idle hover:text-ramp-9",
  active: "text-ramp-10",
  ancestor: "text-nav-idle hover:text-ramp-9",
} as const satisfies Record<NavRow["state"], string>;

export function NavTree({
  rows,
  onNavigate,
}: {
  rows: readonly NavRow[];
  onNavigate?: (href: NavRow["href"]) => void;
}) {
  return (
    <ul>
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
  onNavigate?: (href: NavRow["href"]) => void;
}) {
  return (
    <li>
      <Link
        href={row.href}
        onClick={() => onNavigate?.(row.href)}
        aria-current={row.state === "active" ? "page" : undefined}
        // Typeset's keyboard ring for links in prose, 2px of the ring color
        // 2px out, so it clears the row's first letter.
        className={cn(
          "role-nav flex h-row items-center focus-visible:outline-2 focus-visible:outline-offset-2",
          rowColor[row.state]
        )}
      >
        {row.label}
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
 * Built on Base UI's Drawer directly, for the sheet's inset and width. It
 * takes Kevelle's floating surface, as the registry's dialog does.
 */
export function NavSheet({
  layout,
  ...props
}: {
  rows: readonly NavRow[];
  mark: boolean;
  layout: Layout | null;
}) {
  const pathname = usePathname();
  // Every navigation, history steps included, and every move into the
  // desktop layout mounts a closed sheet, so Base UI releases its scroll lock
  // and Forward never reopens a sheet that Back closed.
  return <Sheet key={`${pathname} ${layout}`} pathname={pathname} {...props} />;
}

function Sheet({
  rows,
  mark,
  pathname,
}: {
  rows: readonly NavRow[];
  mark: boolean;
  pathname: string;
}) {
  const [open, setOpen] = useState(false);
  // A link to another page closes the sheet through the navigation, which
  // mounts a closed sheet in its own transition. Closing it on the click as
  // well commits a synchronous update while the navigation's view transition
  // is pending, and React then skips that view transition. So only a link to
  // the page already open, which changes no pathname, closes the sheet here.
  const onNavigate = (href: NavRow["href"]) => {
    if (href === pathname) setOpen(false);
  };

  return (
    <Drawer.Root open={open} onOpenChange={setOpen} swipeDirection="left">
      <Drawer.Trigger
        aria-label="Open navigation"
        className="flex size-10 flex-col justify-center gap-1.25 px-2.5"
      >
        <span className="bg-ramp-9 h-px w-5" />
        <span className="bg-ramp-9 h-px w-5" />
        <span className="bg-ramp-9 h-px w-3" />
      </Drawer.Trigger>
      <Drawer.Portal>
        <Drawer.Backdrop
          data-slot="nav-sheet-backdrop"
          className="bg-backdrop dither-50 text-backdrop fixed inset-0 transition-opacity duration-(--duration-large) ease-out data-ending-style:opacity-0 data-starting-style:opacity-0 supports-backdrop-filter:backdrop-blur-xs"
        />
        <Drawer.Viewport className="fixed inset-0">
          <Drawer.Popup
            data-slot="nav-sheet"
            className="top-safe-top bottom-safe-bottom left-edge w-sidebar bg-popover shadow-float aura fixed flex translate-x-(--drawer-swipe-movement-x) flex-col transition-transform duration-(--duration-large) ease-out data-ending-style:-translate-x-full data-starting-style:-translate-x-full data-swiping:duration-0"
          >
            <Drawer.Title className="sr-only">Navigation</Drawer.Title>
            <div
              data-slot="sheet-header"
              className="h-header flex shrink-0 items-center justify-between pr-3 pl-5"
            >
              <Identity mark={mark} />
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
            <nav
              data-slot="site-nav"
              aria-label="Site"
              className="min-h-0 overflow-y-auto px-5 pt-3 pb-5"
            >
              <NavTree rows={rows} onNavigate={onNavigate} />
            </nav>
          </Drawer.Popup>
        </Drawer.Viewport>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
