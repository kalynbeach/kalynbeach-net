"use client";

/**
 * The site shell. The root layout renders it once around every page.
 *
 * At 1200px and up there are three sections: the sidebar (the name, the mark
 * and the nav), section 1, and the rail, which mirrors the sidebar on the
 * right and holds only what is live. They sit centered as one block, so
 * section 1 is centered on the window (app/globals.css states the rule). The
 * site map entry for the pathname picks the layout: Home's stage, a page's
 * column, or an admin page's wide section, which takes section 1's and the
 * rail's place. Below 1200px the top bar, the nav sheet and the player bar
 * stand in for the sidebar and the rail. No section has a border, shadow or
 * fill of its own.
 *
 * Pages render section 1's content, their header first. The shell adds what
 * outlives a page: Home's stage, Music's player views, and the header of a
 * page with none of its own.
 *
 * The top line: on desktop the sections start on one grid row, 96 below the
 * window's top. The name and a page's title trim to their cap tops
 * (role-name, role-title), and nothing sits above section 1's first child, so
 * the name's caps and the title's caps share one line on every page, and the
 * sidebar never moves between pages. Home's stage is the exception: it sits
 * dead center on the window.
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

const columns = {
  stage: "desktop:grid-cols-three",
  page: "desktop:grid-cols-three",
  wide: "desktop:grid-cols-wide",
} as const satisfies Record<SiteEntry["kind"], string>;

export function SiteShell({ children }: { children: ReactNode }) {
  const entry = resolve(usePathname());
  const home = entry.kind === "stage";
  const page = entry.kind === "page" ? entry : null;

  return (
    // .root (Kevelle) isolates the page, so Base UI portals stack predictably.
    // It is also the container the geometry measures (cqi).
    <div className="root @container">
      <div
        data-slot="site-sections"
        className={cn(
          "flex min-h-dvh flex-col",
          "desktop:gap-x-gutter desktop:px-margin desktop:py-top desktop:grid desktop:items-start",
          columns[entry.kind]
        )}
      >
        <header className="h-header mx-edge mt-safe-top desktop:hidden flex items-center justify-between pr-3 pl-5">
          <Identity atRest={home} />
          <NavSheet rows={entry.nav} atRest={home} />
        </header>
        <div
          data-slot="site-sidebar"
          // 42 under the name's baseline puts the nav's first 28 row 55 under the top line, as drawn.
          className="max-desktop:hidden desktop:top-top desktop:sticky desktop:flex desktop:flex-col desktop:gap-10.5"
        >
          <Identity atRest={home} />
          <nav data-slot="site-nav" aria-label="Site">
            <NavTree rows={entry.nav} />
          </nav>
        </div>
        <main
          data-slot="site-primary"
          className={cn(
            "max-desktop:mx-edge max-desktop:p-5 flex min-w-0 flex-1 flex-col gap-8",
            // The frame's height, so the stage centers on the window.
            home && "desktop:min-h-frame desktop:justify-center"
          )}
        >
          {home && (
            <div
              data-slot="waveform-stage"
              aria-hidden
              className="max-desktop:w-stage-compact desktop:w-stage max-desktop:my-auto aspect-square self-center"
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
        {entry.kind !== "wide" && (
          // Empty until a later layer mounts what is live: the mini player,
          // the waveform controls, Music's Library. Items stack 40 apart from
          // the top line down, and the rail stays within the frame.
          <aside
            data-slot="site-rail"
            aria-label="Player and controls"
            className="max-desktop:hidden desktop:top-top desktop:max-h-frame desktop:sticky desktop:flex desktop:flex-col desktop:gap-10 desktop:overflow-y-auto"
          />
        )}
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
