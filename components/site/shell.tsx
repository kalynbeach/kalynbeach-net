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
 * It owns the public site's player and waveform: one WavePlayerProvider,
 * where the track list enters, and one WaveformProvider fed by the player's
 * audio, where the look enters. It reads playback and the layout and draws
 * what `place()` (lib/layout.ts) decides: the Home stage, the mark, the
 * player's one frame and its screen. Pages render section 1's content, their
 * header first; the shell adds what outlives a page.
 *
 * The top line: on desktop the sections start on one grid row, 96 below the
 * window's top. The name and a page's title trim to their cap tops
 * (role-name, role-title), and nothing sits above section 1's first child, so
 * the name's caps and the title's caps share one line on every page, and the
 * sidebar never moves between pages. Home's stage is the exception: it sits
 * dead center on the window.
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
  stage: "desktop:grid-cols-three",
  page: "desktop:grid-cols-three",
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
    // It is also the container the geometry measures (cqi).
    <div className="root @container">
      {/* First in the tab order, ahead of the sidebar's nav. Hidden until focused. */}
      <a
        href="#site-primary"
        data-slot="skip-link"
        className="role-nav bg-background text-ramp-10 sr-only z-10 focus-visible:not-sr-only focus-visible:fixed focus-visible:top-3 focus-visible:left-3 focus-visible:px-3 focus-visible:outline-2 focus-visible:outline-offset-2"
      >
        Skip to content
      </a>
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
          "desktop:gap-x-gutter desktop:px-margin desktop:py-top desktop:grid desktop:items-start",
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
        <div
          data-slot="site-sidebar"
          // 42 under the name's baseline puts the nav's first 28 row 55 under the top line, as drawn.
          className="max-desktop:hidden desktop:top-top desktop:sticky desktop:flex desktop:flex-col desktop:gap-10.5"
        >
          <Identity mark={placement.mark === "desktop"} />
          <nav data-slot="site-nav" aria-label="Site">
            <NavTree rows={entry.nav} />
          </nav>
        </div>
        <main
          id="site-primary"
          data-slot="site-primary"
          className={cn(
            // 64 from a page's header to what follows it here: Music's player row, a system page's body.
            "max-desktop:mx-edge max-desktop:p-5 gap-opening flex min-w-0 flex-1 flex-col",
            // The frame's height, so the stage centers on the window.
            placement.live === "stage" &&
              "desktop:min-h-frame desktop:justify-center"
          )}
        >
          {placement.live === "stage" && (
            <div
              data-slot="waveform-stage"
              className="max-desktop:w-stage-compact desktop:w-stage max-desktop:my-auto aspect-square self-center"
            >
              <Waveform form="stage" className="size-full" />
            </div>
          )}
          {page?.title && <PageHeader title={page.title} />}
          {children}
          {placement.frame === "card" && (
            <div className="desktop:flex-row desktop:items-start flex flex-col gap-5">
              {/*
               * kevelle/wave-player's card is a fixed 340px. Below 1200px the
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
        {entry.kind !== "wide" && (
          // Items stack 40 apart from the top line down, and the rail stays
          // within the frame.
          <aside
            data-slot="site-rail"
            aria-label="Player and controls"
            className="max-desktop:hidden desktop:top-top desktop:max-h-frame desktop:sticky desktop:flex desktop:flex-col desktop:gap-10 desktop:overflow-y-auto"
          >
            {placement.frame === "mini" && (
              <div data-slot="rail-player">
                <WavePlayerMini
                  screen={screen}
                  expand={<Link href="/music" />}
                />
              </div>
            )}
          </aside>
        )}
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
