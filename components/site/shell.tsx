"use client";

/**
 * The site shell. The root layout renders it once around every page.
 *
 * It resolves the site map entry for the current pathname and draws what the
 * entry decides: the nav (section 2), Home's stage, Music's player views and
 * the header of a page with none of its own. Pages render section 1's
 * content, their header first.
 *
 * A client component because the pathname is only readable on the client.
 * It still renders on the server for the first request. Nothing here sits
 * inside a ViewTransition: the stage and the player views persist across
 * navigation, and a transition snapshot would freeze them.
 */
import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { resolve, siteName, type SiteEntry } from "@/lib/site";
import { Waveform } from "@/components/waveform";
import {
  WavePlayerBar,
  WavePlayerCard,
  WavePlayerLibrary,
} from "@/components/wave-player";
import { Identity, NavSheet, NavTree } from "@/components/site/nav";
import { PageHeader } from "@/components/site/page-header";
import { CommandMenu } from "@/components/site/command-menu";

export function SiteShell({ children }: { children: ReactNode }) {
  const entry = resolve(usePathname());
  const player = entry.kind === "page" ? entry.player : null;

  return (
    // .root (Kevelle) isolates the page, so Base UI portals and the -z-10 stage stack predictably.
    <div className="root min-h-dvh">
      {entry.kind === "stage" && (
        <div
          aria-hidden
          className="size-stage pointer-events-none fixed top-1/2 left-1/2 -z-10 -translate-x-1/2 -translate-y-1/2"
        >
          <Waveform form="stage" />
        </div>
      )}
      <div className="desktop:grid desktop:grid-cols-shell desktop:justify-center desktop:gap-x-gutter desktop:px-edge desktop:py-lead">
        <nav
          data-slot="site-nav"
          aria-label="Site"
          className="max-desktop:hidden desktop:sticky desktop:top-lead desktop:self-start"
        >
          <Identity layout="row" atRest={entry.kind === "stage"} />
          <NavTree rows={entry.nav} />
        </nav>
        <SiteMain entry={entry}>{children}</SiteMain>
      </div>
      {player === "follow" && (
        <div className="inset-x-edge bottom-safe-bottom desktop:hidden fixed">
          <WavePlayerBar />
        </div>
      )}
      <CommandMenu />
    </div>
  );
}

/**
 * Section 1. The same element on every route, so the top bar and its sheet
 * keep their place between Home and the pages. On Home it has no box: the
 * stage stands in for it, and below 1100px only the top bar shows.
 */
function SiteMain({
  entry,
  children,
}: {
  entry: SiteEntry;
  children: ReactNode;
}) {
  const page = entry.kind === "stage" ? null : entry;

  return (
    <main
      data-slot={page ? "site-main" : undefined}
      className={cn(
        "max-desktop:mx-edge max-desktop:mt-safe-top desktop:self-start",
        page?.kind === "page" &&
          page.player === "follow" &&
          "max-desktop:pb-clear-bar"
      )}
    >
      {/* Below 1100px the top bar is section 1's header. */}
      <div className="h-header desktop:hidden flex items-center justify-between pr-3 pl-5">
        <Identity layout="inline" atRest={!page} />
        <NavSheet rows={entry.nav} atRest={!page} />
      </div>
      {page ? (
        <div className="desktop:p-inset flex flex-col gap-8 p-5">
          {page.kind === "page" && page.title && (
            <PageHeader title={page.title} />
          )}
          {children}
          {page.kind === "page" && page.player === "full" && (
            <div className="flex flex-col items-center gap-8">
              <WavePlayerCard />
              <WavePlayerLibrary />
            </div>
          )}
        </div>
      ) : (
        <>
          <h1 className="sr-only">{siteName}</h1>
          {children}
        </>
      )}
    </main>
  );
}
