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
 * fed the track list the root layout read from Convex for this document
 * (tracks.list through fetchPublicQuery), and one WaveformProvider fed by
 * the player's audio, where the site's look enters. The player draws its own
 * waveform in its frames (PlayerScreen), so the site's figure stays on Home's
 * stage and in the mark. It reads playback and the layout and draws what
 * `place()` (lib/layout.ts) decides: the Home stage, the mark and the
 * player's one frame. Pages render section 1's content, their header first;
 * the shell adds what outlives a page.
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
  useEffect,
  useEffectEvent,
  useLayoutEffect,
  useRef,
  useMemo,
  useState,
  useSyncExternalStore,
  type ReactNode,
  type RefObject,
} from "react";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { desktopMedia, place, type Layout } from "@/lib/layout";
import { resolve, type SiteEntry } from "@/lib/site";
import { Waveform, WaveformProvider } from "@/components/waveform/waveform";
import {
  DEFAULT_WAVEFORM_CONFIG,
  parseWaveformConfig,
  type WaveformConfig,
} from "@/components/waveform/settings";
import {
  WavePlayerBar,
  WavePlayerCard,
  WavePlayerMini,
  WavePlayerProvider,
  WavePlayerTracks,
  useWavePlayer,
  type WavePlayerTrack,
} from "@/components/wave-player/wave-player";
import { Identity, NavSheet, NavTree } from "@/components/site/nav";
import { PageHeader } from "@/components/site/page-header";
import { CommandMenu } from "@/components/site/command-menu";
import {
  WaveformControls,
  WaveformGhost,
  pointerZone,
  useWaveformControls,
} from "@/components/site/waveform-controls";

const columns = {
  stage: "desktop:grid-cols-three",
  page: "desktop:grid-cols-three",
  wide: "desktop:grid-cols-wide",
} as const satisfies Record<SiteEntry["kind"], string>;

export function SiteShell({
  tracks,
  children,
}: {
  /** tracks.list as of this document's request, or [] when Convex failed or was slow. */
  tracks: readonly WavePlayerTrack[];
  children: ReactNode;
}) {
  return (
    <WavePlayerProvider tracks={tracks} screen={<PlayerScreen />}>
      <PublicWaveform>
        <Sections>{children}</Sections>
      </PublicWaveform>
    </WavePlayerProvider>
  );
}

/**
 * The player's own waveform, which the block moves between the card, the
 * mini player and the bar. It draws the current track's look, or the
 * block's default player look, fed by the playing audio. Its canvas takes no
 * view-transition name: it rides inside the frame's morph, and the site's
 * figure already carries `waveform`.
 */
function PlayerScreen() {
  const { feed, look, hold } = useWavePlayer();
  const config = useMemo(() => parseWaveformConfig(look), [look]);

  return (
    <WaveformProvider
      config={config}
      audio={feed}
      hold={hold}
      viewTransitionName={null}
    >
      <Waveform form="screen" className="size-full" />
    </WaveformProvider>
  );
}

/**
 * The Home stage's keys edit a local copy of the look that nothing saves and
 * a reload drops. setLocal takes the exact object onConfigChange gives, since
 * the keys know their own commits by identity.
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
  const placement = place(entry, useWavePlayer().active, layout);
  const reducedMotion = useReducedMotion();
  const page = entry.kind === "page" ? entry : null;
  const music = placement.frame === "card";
  // Home's waveform controls show on desktop only. Below 1200px the keys
  // still play, and the block's own key guide answers ?.
  const controlsShown = placement.stage && layout === "desktop";
  const controls = useWaveformControls(controlsShown);
  // What the rail holds, top to bottom: the mini player and the open
  // waveform controls, or Music's Library. The controls' state closes only
  // in an effect after they unmount, so it counts only while they render.
  const railHolds =
    (controlsShown && controls.state.panel.kind === "open") ||
    placement.frame === "mini" ||
    music;
  // A landmark only while it holds something, so screen readers never land
  // in an empty one. The empty column keeps its box. On Home's desktop the
  // element stays an aside, role none while empty, so opening the controls
  // doesn't remount the rail and cut their entrance.
  const Rail = railHolds || controlsShown ? "aside" : "div";
  const [miniShown, setMiniShown] = useState(false);

  useScrollToTop(pathname);
  const stage = useRef<HTMLDivElement>(null);
  useUndescribedStage(stage, placement.stage);

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
            // 64 from a page's header to what follows it here: a system page's body, Music's card below 1200px.
            "max-desktop:mx-edge max-desktop:p-5 gap-opening flex min-w-0 flex-1 flex-col",
            // The frame's height, so the stage centers on the window.
            placement.stage && "desktop:min-h-frame desktop:justify-center",
            /*
             * Music's card, dead center: its top is max((window - card) / 2,
             * header bottom + 32). The page's MDX body (.typeset) above the
             * card and main's ::after below it grow by equal shares from
             * flex bases that sum to 0: the body's -32 top margin offsets its
             * 32 bottom margin, the gap to the card, and its 32 ::before puts
             * the header back on the top line. The body never shrinks below
             * its content, so the card never rises above header bottom + 32,
             * and nothing under the card has a size of its own, so a card too
             * tall to center scrolls the page only as far as it must. A grid
             * can't do this: under an indefinite height its empty 1fr row
             * takes the header row's size.
             */
            music &&
              "desktop:min-h-frame desktop:gap-0 desktop:after:flex-[1_1_0px] desktop:[&>.typeset]:-mt-8 desktop:[&>.typeset]:mb-8 desktop:[&>.typeset]:flex-[1_1_0px] desktop:[&>.typeset]:before:block desktop:[&>.typeset]:before:h-8"
          )}
        >
          {placement.stage && (
            // The stage's box, which the ghost sits under. The ghost comes
            // first, so it is the next tab stop after the nav.
            <div
              className="max-desktop:w-stage-compact desktop:w-stage max-desktop:my-auto relative aspect-square self-center"
              {...(controlsShown ? pointerZone(controls, "stage") : {})}
            >
              {controlsShown && <WaveformGhost controls={controls} />}
              <div ref={stage} data-slot="waveform-stage" className="size-full">
                {/* Page-wide keys: a visitor plays the figure with nothing focused, until the controls' switch turns them off. The choice holds below 1200px too, where the switch isn't shown. */}
                <Waveform
                  form="stage"
                  keys={controls.pageKeys ? "page" : "focus"}
                  className="size-full"
                />
              </div>
            </div>
          )}
          {page?.title && <PageHeader title={page.title} />}
          {children}
          {music && (
            // Below 1200px the Library follows the card; on desktop it is in the rail.
            <div className="desktop:contents flex flex-col items-center gap-5">
              {/* kevelle/wave-player's card fills this box up to 340px. */}
              <div
                data-slot="music-card"
                className="w-full max-w-85 self-center"
              >
                <WavePlayerCard />
              </div>
              <div className="desktop:hidden w-full">
                <WavePlayerTracks />
              </div>
            </div>
          )}
        </main>
        {entry.kind !== "wide" && (
          // Items stack 40 apart from the top line down, and the rail stays
          // within the frame. It starts 8 above the top line, padded back
          // down, so a labelled item's header, which rises 8 to put its
          // label's caps on the line, isn't clipped. The mini player goes
          // first, and the waveform controls open under it.
          <Rail
            data-slot="site-rail"
            role={Rail === "aside" && !railHolds ? "none" : undefined}
            aria-label={railHolds ? "Player and controls" : undefined}
            className="max-desktop:hidden desktop:top-[calc(var(--spacing-top)-0.5rem)] desktop:max-h-[calc(var(--spacing-frame)+0.5rem)] desktop:sticky desktop:-mt-2 desktop:flex desktop:flex-col desktop:gap-10 desktop:overflow-y-auto desktop:pt-2"
            {...(controlsShown ? pointerZone(controls, "rail") : {})}
          >
            {placement.frame === "mini" && (
              <RailPlayer
                first={!miniShown}
                onShown={() => setMiniShown(true)}
              />
            )}
            {controlsShown && (
              <WaveformControls
                controls={controls}
                underMini={placement.frame === "mini"}
              />
            )}
            {music && (
              <div
                data-slot="rail-library"
                // The block's Library header is a 52 row that centers its
                // label, so the label's cap top sits 23 below the row's top.
                // This lifts it onto the top line.
                className="-mt-5.75"
              >
                <WavePlayerTracks />
              </div>
            )}
          </Rail>
        )}
        {placement.frame === "bar" && (
          // Sticky and last in the column: it rests on the window's bottom
          // edge and takes its own height at the end of the page, so nothing
          // ends up under it however its title wraps.
          <WavePlayerBar className="bottom-safe-bottom mx-edge mb-safe-bottom desktop:hidden sticky w-auto" />
        )}
      </div>
      <CommandMenu />
    </div>
  );
}

/**
 * The mini player in the rail. Its first appearance in a visit fades it in,
 * rising 4px; later ones arrive with the block's own fade or morph alone. A
 * Web Animation, since Kevelle's reduced-motion rule cuts every CSS animation
 * short, and under reduced motion the fade keeps only the opacity. During a
 * view transition the browser draws the frame's own morph over the page, so
 * this fade shows only where no transition runs, as under reduced motion.
 */
function RailPlayer({
  first,
  onShown,
}: {
  /** No mini player has appeared yet this visit. Read when it mounts. */
  first: boolean;
  onShown: () => void;
}) {
  const box = useRef<HTMLDivElement>(null);
  const enter = useEffectEvent(() => {
    if (!first) return;
    onShown();
    const reduced = window.matchMedia(reducedMotionMedia).matches;
    box.current?.animate(
      reduced
        ? { opacity: [0, 1] }
        : { opacity: [0, 1], translate: ["0 4px", "0 0"] },
      { duration: 200, easing: "cubic-bezier(0.23, 1, 0.32, 1)" }
    );
  });

  useLayoutEffect(() => enter(), []);

  return (
    <div ref={box} data-slot="rail-player">
      <WavePlayerMini expand={<Link href="/music" />} />
    </div>
  );
}

/**
 * kevelle/waveform describes its stage button with its own key hint, which
 * the site never shows (app/globals.css). A screen reader still reads text
 * a button names in aria-describedby, hidden or not, so the site drops the
 * reference once the stage mounts. The block sets it from a stable useId,
 * so React never writes it back.
 */
function useUndescribedStage(
  stage: RefObject<HTMLElement | null>,
  shown: boolean
) {
  useLayoutEffect(() => {
    stage.current
      ?.querySelector("button[aria-describedby]")
      ?.removeAttribute("aria-describedby");
  }, [stage, shown]);
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

/**
 * Opens a page at its top after a forward navigation. Next.js scrolls only
 * when the page segment's top is out of view, and on desktop section 1
 * starts at the top line, 96 below the window's top, so a page opened from
 * one scrolled less than that opened partway down. Back and Forward keep the position the browser
 * restores.
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
