"use client";

/**
 * The site shell. The root layout renders it once around every page.
 *
 * At 1100px and up there are two sections: the sidebar (the name, the nav
 * and the mini player) and section 1. The site map entry for the pathname
 * picks the layout: Home's stage, a page's column, or an admin page's wide
 * section. Below 1100px the top bar, the nav sheet and the player bar stand
 * in for the sidebar. No section has a border, shadow or fill of its own.
 *
 * It owns the public site's player and waveform: one WavePlayerProvider,
 * where the track list enters, and one WaveformProvider fed by the player's
 * audio, where the look enters. It reads playback and the layout and draws
 * what `place()` (lib/layout.ts) decides: the Home stage, the mark, the
 * player's one frame and its screen. Pages render section 1's content, their
 * header first; the shell adds what outlives a page.
 *
 * The top line: on desktop the sidebar and section 1 start on one grid row,
 * the lead below the window's top. The name and a page's title trim to their
 * cap tops (role-name, role-title), and nothing sits above section 1's first
 * child, so the name's caps, the title's caps and Home's stage share one line
 * on every page, and the sidebar never moves between pages.
 *
 * A client component because the pathname is only readable on the client.
 * It still renders on the server for the first request, with playback off
 * and the layout unknown.
 */
import Link from "next/link";
import {
  ViewTransition,
  useDeferredValue,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { desktopMedia, place, type Layout, type Playback } from "@/lib/layout";
import { sampleTracks } from "@/lib/sample-tracks";
import { resolve, type SiteEntry } from "@/lib/site";
import { Waveform, WaveformProvider } from "@/components/waveform/waveform";
import {
  DEFAULT_WAVEFORM_CONFIG,
  type WaveformConfig,
} from "@/components/waveform/settings";
import {
  WavePlayerBar,
  WavePlayerCard,
  WavePlayerMini,
  WavePlayerProvider,
  WavePlayerTracks,
  useWavePlayer,
} from "@/components/wave-player/wave-player";
import { Identity, NavSheet, NavTree } from "@/components/site/nav";
import { PageHeader } from "@/components/site/page-header";
import { CommandMenu } from "@/components/site/command-menu";

const columns = {
  stage: "desktop:grid-cols-column",
  page: "desktop:grid-cols-column",
  wide: "desktop:grid-cols-wide",
} as const satisfies Record<SiteEntry["kind"], string>;

export function SiteShell({ children }: { children: ReactNode }) {
  return (
    <WavePlayerProvider tracks={sampleTracks}>
      <PublicWaveform>
        <Sections>{children}</Sections>
      </PublicWaveform>
    </WavePlayerProvider>
  );
}

/**
 * The Home stage's keys edit a local copy of the look that nothing saves and
 * a reload drops.
 */
function PublicWaveform({ children }: { children: ReactNode }) {
  // An audio restart replaces the feed, so read it on every render.
  const { feed } = useWavePlayer();
  const [local, setLocal] = useState<WaveformConfig | null>(null);

  return (
    <WaveformProvider
      config={local ?? DEFAULT_WAVEFORM_CONFIG}
      onConfigChange={setLocal}
      audio={feed}
    >
      {children}
    </WaveformProvider>
  );
}

function Sections({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const entry = resolve(pathname);
  const layout = useLayout();
  const placement = place(entry, usePlayback(), layout);
  const reducedMotion = useReducedMotion();
  const page = entry.kind === "page" ? entry : null;
  const screen =
    placement.live === "screen" ? (
      <Waveform form="screen" className="size-full" />
    ) : undefined;

  return (
    // .root (Kevelle) isolates the page, so Base UI portals stack predictably.
    <div className="root">
      {/*
       * React starts a browser view transition for a navigation only when
       * its commit places a ViewTransition, whatever its classes; a canvas's
       * CSS name never starts one. Keyed by the pathname, this one is placed
       * on every route change, so the waveform morphs even where no player
       * frame comes or goes. It wraps nothing, so it animates nothing itself.
       */}
      {!reducedMotion && <ViewTransition key={pathname} default="none" />}
      <div
        data-slot="site-sections"
        className={cn(
          "flex min-h-dvh flex-col",
          "desktop:gap-x-gutter desktop:px-margin desktop:py-lead desktop:grid desktop:items-start",
          columns[entry.kind]
        )}
      >
        <header className="h-header mx-edge mt-safe-top desktop:hidden flex items-center justify-between pr-3 pl-5">
          <Identity mark={placement.mark === "narrow"} />
          <NavSheet
            rows={entry.nav}
            mark={placement.mark === "narrow"}
            layout={layout}
          />
        </header>
        {/* At its track's end, so the sidebar sits beside section 1, not at the window's edge. */}
        <div
          data-slot="site-sidebar"
          className="max-desktop:hidden desktop:top-lead desktop:w-sidebar desktop:sticky desktop:flex desktop:flex-col desktop:justify-self-end desktop:gap-8"
        >
          <Identity mark={placement.mark === "desktop"} />
          <nav data-slot="site-nav" aria-label="Site">
            <NavTree rows={entry.nav} />
          </nav>
          <div data-slot="sidebar-player">
            {placement.frame === "mini" && (
              <WavePlayerMini screen={screen} expand={<Link href="/music" />} />
            )}
          </div>
        </div>
        <main
          data-slot="site-primary"
          className="max-desktop:mx-edge max-desktop:p-5 flex min-w-0 flex-1 flex-col gap-8"
        >
          {placement.live === "stage" && (
            <div
              data-slot="waveform-stage"
              className="w-stage max-desktop:my-auto mx-auto aspect-square"
            >
              <Waveform form="stage" className="size-full" />
            </div>
          )}
          {page?.title && <PageHeader title={page.title} />}
          {children}
          {placement.frame === "card" && (
            <div className="desktop:flex-row desktop:items-start flex flex-col gap-5">
              {/*
               * kevelle/wave-player's card is a fixed 340px. Below 1100px the
               * row gives up section 1's padding, so the card fits from 364px
               * up, and narrower windows zoom the row to fit it at 320px.
               */}
              <div
                data-slot="card-row"
                className="max-desktop:-mx-5 flex justify-center max-[22.75rem]:[zoom:calc(296/340)]"
              >
                <WavePlayerCard screen={screen} />
              </div>
              <WavePlayerTracks className="desktop:flex-1" />
            </div>
          )}
        </main>
        {placement.frame === "bar" && (
          // Sticky and last in the column: it rests on the window's bottom
          // edge and takes its own height at the end of the page, so nothing
          // ends up under it however its title wraps.
          <WavePlayerBar
            screen={screen}
            className="bottom-safe-bottom mx-edge mb-safe-bottom desktop:hidden sticky w-auto"
          />
        )}
      </div>
      <CommandMenu />
    </div>
  );
}

/**
 * The layout in script, for what CSS must not place: the mark and the
 * player's frame carry view-transition names, and an element CSS hides is
 * still mounted and still named. null on the server and through hydration.
 * Deferred, so crossing the breakpoint renders in a transition lane and the
 * arriving mini player or bar fades in. The media query hides the leaving
 * one first, so the two don't morph into each other.
 */
function useLayout(): Layout | null {
  return useDeferredValue(
    useSyncExternalStore(subscribeLayout, readLayout, () => null)
  );
}

function subscribeLayout(onChange: () => void) {
  const query = window.matchMedia(desktopMedia);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

function readLayout(): Layout {
  return window.matchMedia(desktopMedia).matches ? "desktop" : "narrow";
}

/**
 * `active` is deferred in the block, so the frames it mounts animate;
 * `ended` is deferred here to change in the same render, or Replay would
 * show a render with neither and the card would drop the live waveform for
 * a frame.
 */
function usePlayback(): Playback {
  const { active, status } = useWavePlayer();
  const ended = useDeferredValue(status.kind === "ended");

  return active ? "active" : ended ? "ended" : "idle";
}

const reducedMotionMedia = "(prefers-reduced-motion: reduce)";

/** true on the server, so the first render places no ViewTransition. */
function useReducedMotion(): boolean {
  return useSyncExternalStore(
    subscribeReducedMotion,
    () => window.matchMedia(reducedMotionMedia).matches,
    () => true
  );
}

function subscribeReducedMotion(onChange: () => void) {
  const query = window.matchMedia(reducedMotionMedia);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}
