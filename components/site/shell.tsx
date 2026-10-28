"use client";

/**
 * The site shell. The root layout renders it once around every page.
 *
 * It owns the public site's player and waveform: one WavePlayerProvider,
 * where the track list enters, and one WaveformProvider fed by the player's
 * audio, where the look enters. It resolves the site map entry for the
 * current pathname, reads playback and the layout, and draws everything
 * `place()` (lib/layout.ts) decides: the nav (section 2), section 1's header,
 * the Home stage, the glow, the mark, the player's one frame and its screen,
 * and the Library. The page's `children` are the blocks of section 1's body
 * and nothing else.
 *
 * A client component because the pathname is only readable on the client.
 * It still renders on the server for the first request, with playback off
 * and the layout unknown.
 */
import Link from "next/link";
import {
  Fragment,
  ViewTransition,
  useDeferredValue,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
  type Ref,
} from "react";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  desktopMedia,
  place,
  type Layout,
  type Placement,
  type Playback,
} from "@/lib/layout";
import { sampleTracks } from "@/lib/sample-tracks";
import { resolve, siteName, type SiteEntry } from "@/lib/site";
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
import { CommandMenu } from "@/components/site/command-menu";

type PageEntry = Extract<SiteEntry, { kind: "page" }>;

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
 * The public site's one WaveformProvider, reacting to the player's audio.
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
  // The glow's anchor, held in state so the glow follows it.
  const [main, setMain] = useState<HTMLElement | null>(null);
  const screen =
    placement.live === "screen" ? (
      <Waveform form="screen" className="size-full" />
    ) : undefined;

  useScrollToTop(pathname);

  return (
    // .root (Kevelle) isolates the page, so Base UI portals and the -z-10 glow stack predictably.
    <div className="root min-h-dvh">
      {/*
       * React starts a browser view transition for a navigation only when
       * its commit places a ViewTransition, whatever its classes; a canvas's
       * CSS name never starts one. Keyed by the pathname, this one is placed
       * on every route change, so the waveform morphs even where no player
       * frame comes or goes. It wraps nothing, so it animates nothing itself.
       */}
      {!reducedMotion && <ViewTransition key={pathname} default="none" />}
      {placement.glow !== null && (
        <Waveform
          form="glow"
          anchor={main}
          present={placement.glow}
          className="fixed inset-0 -z-10"
        />
      )}
      <div
        data-slot="site-sections"
        className="max-desktop:flex max-desktop:min-h-dvh max-desktop:flex-col desktop:grid desktop:grid-cols-shell desktop:justify-center desktop:gap-x-gutter desktop:px-edge desktop:py-lead [view-transition-name:site]"
      >
        <nav
          data-slot="site-nav"
          aria-label="Site"
          className="bg-background max-desktop:hidden desktop:sticky desktop:top-lead desktop:self-start"
        >
          <Identity layout="row" mark={placement.mark === "desktop"} />
          <NavTree rows={entry.nav} />
        </nav>
        <SiteMain
          ref={setMain}
          entry={entry}
          placement={placement}
          layout={layout}
          screen={screen}
        >
          {children}
        </SiteMain>
        {(entry.kind === "stage" || entry.player !== null) && (
          // Section 3. The same element on Home and every page with a player
          // role, so the mini player stays mounted from page to page.
          <div
            data-slot="site-aside"
            className={cn(
              "bg-background desktop:sticky desktop:top-lead desktop:self-start",
              placement.library && "max-desktop:mx-edge max-desktop:my-3"
            )}
          >
            {placement.library && <WavePlayerTracks />}
            {placement.frame === "mini" && (
              <WavePlayerMini screen={screen} expand={<Link href="/music" />} />
            )}
          </div>
        )}
        {placement.frame === "bar" && (
          // Below 1100px. Sticky and last in the column: it rests on the
          // window's bottom edge and takes its own height at the end of the
          // page, so nothing ends up under it however its title wraps.
          <WavePlayerBar
            screen={screen}
            className="bottom-safe-bottom mx-edge mb-safe-bottom sticky mt-auto w-auto"
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
 * mini player and the bar morph into each other.
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
 * The player's phase for `place()`. `active` is deferred in the block, so
 * the frames it mounts animate; `ended` is deferred here to change in the
 * same render, or Replay would show a render with neither and the card
 * would drop the live waveform for a frame.
 */
function usePlayback(): Playback {
  const { active, status } = useWavePlayer();
  const ended = useDeferredValue(status.kind === "ended");

  return active ? "active" : ended ? "ended" : "idle";
}

const reducedMotionMedia = "(prefers-reduced-motion: reduce)";

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

/**
 * Opens a page at its top after a forward navigation. Next.js scrolls only
 * when the page segment's own DOM is out of view, and section 1's header
 * renders here, outside that segment; Music's page renders no DOM at all.
 * Back and Forward keep the position the browser restores.
 */
function useScrollToTop(pathname: string) {
  const traversedTo = useRef<string | null>(null);
  const shown = useRef(pathname);

  useEffect(() => {
    const note = () => {
      traversedTo.current = window.location.pathname;
    };
    // Capture, so the note lands before Next.js's own listener renders the page.
    window.addEventListener("popstate", note, { capture: true });
    return () =>
      window.removeEventListener("popstate", note, { capture: true });
  }, []);

  useLayoutEffect(() => {
    if (pathname === shown.current) return;
    shown.current = pathname;
    const traversal = traversedTo.current === pathname;
    traversedTo.current = null;
    if (!traversal) window.scrollTo(0, 0);
  }, [pathname]);
}

/**
 * Section 1. The same element on every route, so the top bar and its sheet
 * keep their place between Home and the pages, and the glow keeps its
 * anchor. On Home it has no box: the stage stands in for it, and below
 * 1100px only the top bar shows.
 */
function SiteMain({
  ref,
  entry,
  placement,
  layout,
  screen,
  children,
}: {
  ref: Ref<HTMLElement>;
  entry: SiteEntry;
  placement: Placement;
  layout: Layout | null;
  screen: ReactNode;
  children: ReactNode;
}) {
  const page = entry.kind === "page" ? entry : null;

  return (
    <main
      ref={ref}
      data-slot={page ? "site-main" : undefined}
      className={cn(
        "max-desktop:mx-edge max-desktop:mt-safe-top desktop:self-start",
        page && "bg-background"
      )}
    >
      {/*
       * Two page-header rows. Below 1100px the top bar is section 1's header
       * and the breadcrumb drops into the body; at 1100px and up the top bar
       * hides and the breadcrumb row is the header. z-10 keeps the top bar
       * above the stage in near-square windows.
       */}
      <div
        data-slot={page ? "page-header" : undefined}
        className="h-header desktop:hidden relative z-10 flex items-center justify-between pr-3 pl-5"
      >
        <Identity layout="inline" mark={placement.mark === "narrow"} />
        <NavSheet
          rows={entry.nav}
          mark={placement.mark === "narrow"}
          layout={layout}
        />
      </div>
      {page ? (
        <>
          <div
            data-slot="page-header"
            className="desktop:h-header desktop:px-inset desktop:pt-0 flex items-center px-5 pt-5"
          >
            <Breadcrumb crumbs={page.crumbs} />
          </div>
          <div className="desktop:p-inset flex flex-col gap-8 p-5">
            <hgroup className="desktop:gap-3 flex flex-col gap-2">
              <h1 className="role-title text-ramp-10">{page.title}</h1>
              {page.lede && (
                <p data-slot="page-lede" className="role-lede text-ramp-7">
                  {page.lede}
                </p>
              )}
            </hgroup>
            {placement.frame === "card" && (
              // kevelle/wave-player's card is a fixed 340px. Below 1100px the
              // row gives up section 1's padding, so the card fits from 364px
              // up, and narrower windows zoom the row to fit it at 320px.
              <div
                data-slot="card-row"
                className="max-desktop:-mx-5 flex justify-center max-[22.75rem]:[zoom:calc(296/340)]"
              >
                <WavePlayerCard screen={screen} />
              </div>
            )}
            {children}
          </div>
        </>
      ) : (
        <>
          <h1 className="sr-only">{siteName}</h1>
          {placement.live === "stage" && (
            <Waveform
              form="stage"
              className="size-stage fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
            />
          )}
          {children}
        </>
      )}
    </main>
  );
}

/** "SOFTWARE / AGENTS". Text, not links: the parent crumb would only redirect back here. */
function Breadcrumb({ crumbs }: { crumbs: PageEntry["crumbs"] }) {
  return (
    <p data-slot="breadcrumb" className="flex w-fit items-center gap-2">
      {crumbs.map((crumb, index) => (
        <Fragment key={crumb}>
          {index > 0 && (
            <span aria-hidden className="role-mono-sm text-ramp-5 font-medium">
              /
            </span>
          )}
          <span
            className={cn(
              "role-caps",
              index === crumbs.length - 1 ? "text-ramp-8" : "text-ramp-6"
            )}
          >
            {crumb}
          </span>
        </Fragment>
      ))}
    </p>
  );
}
