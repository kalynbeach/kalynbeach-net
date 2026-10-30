"use client";

/**
 * The site shell. The root layout renders it once around every page.
 *
 * At 1100px and up there are two sections: the sidebar (the name, the nav
 * and the mini player's slot) and section 1. The site map entry for the
 * pathname picks the layout: Home's stage, a page's column centered in the
 * window, or an admin page's wide section. Below 1100px the top bar, the nav
 * sheet and the player bar stand in for the sidebar. No section has a
 * border, shadow or fill of its own.
 *
 * Pages render section 1's content, their header first. The shell adds what
 * outlives a page: Home's stage, Music's player views, and the header of a
 * page with none of its own.
 *
 * The top line: on desktop the sidebar and section 1 start on one grid row,
 * the lead below the window's top. The name and a page's title trim to their
 * cap tops (role-name, role-title), and nothing sits above section 1's first
 * child, so the name's caps, the title's caps and Home's stage share one line
 * on every page, and the sidebar never moves between pages.
 *
 * A client component because the pathname is only readable on the client.
 * It still renders on the server for the first request. Nothing here sits
 * inside a ViewTransition: the stage and the player views persist across
 * navigation, and a transition snapshot would freeze them.
 */
import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { resolve, type SiteEntry } from "@/lib/site";
import { Waveform } from "@/components/waveform";
import {
  WavePlayerBar,
  WavePlayerCard,
  WavePlayerLibrary,
} from "@/components/wave-player";
import { Identity, NavSheet, NavTree } from "@/components/site/nav";
import { PageHeader } from "@/components/site/page-header";
import { CommandMenu } from "@/components/site/command-menu";

/** Desktop tracks for each layout, from globals.css. */
const columns = {
  stage: "desktop:grid-cols-column",
  page: "desktop:grid-cols-column",
  wide: "desktop:grid-cols-wide",
} as const satisfies Record<SiteEntry["kind"], string>;

export function SiteShell({ children }: { children: ReactNode }) {
  const entry = resolve(usePathname());
  const home = entry.kind === "stage";
  const page = entry.kind === "page" ? entry : null;

  return (
    // .root (Kevelle) isolates the page, so Base UI portals stack predictably.
    <div className="root">
      <div
        data-slot="site-sections"
        className={cn(
          "flex min-h-dvh flex-col",
          "desktop:gap-x-gutter desktop:px-margin desktop:py-lead desktop:grid desktop:items-start",
          columns[entry.kind]
        )}
      >
        <header className="h-header mx-edge mt-safe-top desktop:hidden flex items-center justify-between pr-3 pl-5">
          <Identity atRest={home} />
          <NavSheet rows={entry.nav} atRest={home} />
        </header>
        {/* At its track's end, so the sidebar sits beside section 1, not at the window's edge. */}
        <div
          data-slot="site-sidebar"
          className="max-desktop:hidden desktop:top-lead desktop:w-sidebar desktop:sticky desktop:flex desktop:flex-col desktop:justify-self-end desktop:gap-8"
        >
          <Identity atRest={home} />
          <nav data-slot="site-nav" aria-label="Site">
            <NavTree rows={entry.nav} />
          </nav>
          {/* The mini player's slot. Empty until #38 mounts the player here. */}
          <div data-slot="sidebar-player" />
        </div>
        <main
          data-slot="site-primary"
          className="max-desktop:mx-edge max-desktop:p-5 flex min-w-0 flex-1 flex-col gap-8"
        >
          {home && (
            <div
              data-slot="waveform-stage"
              aria-hidden
              className="w-stage max-desktop:my-auto mx-auto aspect-square"
            >
              <Waveform form="stage" />
            </div>
          )}
          {page?.title && <PageHeader title={page.title} />}
          {children}
          {page?.player === "full" && (
            <div className="flex flex-wrap items-start gap-5">
              <div className="w-85 max-w-full">
                <WavePlayerCard />
              </div>
              <div className="min-w-60 flex-1">
                <WavePlayerLibrary />
              </div>
            </div>
          )}
        </main>
        {page?.player === "follow" && (
          // Last in the column: the page ends above the bar, and the bar rests on the window's bottom edge.
          <div className="bottom-safe-bottom mx-edge mb-safe-bottom desktop:hidden sticky">
            <WavePlayerBar />
          </div>
        )}
      </div>
      <CommandMenu />
    </div>
  );
}
