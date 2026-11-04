"use client";

/*
 * kevelle/wave-player: one music player with four views a site places
 * anywhere under one provider.
 *
 *   import {
 *     WavePlayerProvider,
 *     WavePlayerCard,
 *     WavePlayerTracks,
 *     WavePlayerMini,
 *     WavePlayerBar,
 *     useWavePlayer,
 *   } from "@/components/wave-player/wave-player"
 *
 *   <WavePlayerProvider tracks={tracks} screen={<PlayerScreen />}>{children}</WavePlayerProvider>
 *
 *   <WavePlayerCard />                                   the card, up to 340 wide
 *   <WavePlayerTracks />                                 the Library list
 *   <WavePlayerMini expand={<Link href="/music" />} />   the mini player, up to 240 wide
 *   <WavePlayerBar className="fixed inset-x-3 bottom-8" />
 *   <WavePlayerCard specimen />                          a style guide's extra frame
 *
 *   const { feed, status, active, look, hold } = useWavePlayer()
 *
 * Views. The card fills its container up to 340 wide: the title, the
 * status and duration, the screen, the byline, the tag, a bar-waveform seek
 * bar, and the transport. The mini player has a layout of its own for a
 * narrow column and fills its container up to 240 wide: the title beside
 * the expand control, the artist and the status, then a 72px screen beside
 * a large elapsed time over the duration and the transport, and a thin
 * seek line. Below 240 its time and transport wrap under the screen. The
 * bar is one row on a small Card, the 36px screen, the title over the
 * time, and the transport, over a thin progress line, with no seek. Every
 * view wraps a long title and never truncates it.
 *
 * Type. Time readouts keep --font-pixel. They are the elapsed time, the
 * remaining time, every duration, and --:-- for an unknown time. The other
 * pixel-style text takes --font-label: the card's track counter, the
 * Library's track count, and the status and tag Badges. It keeps the pixel
 * size and tracking, and --font-label defaults to --font-pixel, so Kevelle
 * looks the same until a host sets the label font to its own face.
 *
 * Provider. Put it where it outlives navigation, such as a Next.js root
 * layout. Playback lives there, so views mount and unmount freely. `tracks`
 * is plain data a server component can pass, in play order: { id, title,
 * src, artist?, record?, tag?, duration?, peaks?, look? }. Each id is
 * stable and unique. A record the player can't use is dropped with one
 * console warning, never thrown, and a fresh array of the same tracks
 * changes nothing. Without `duration`, the player reads the current track's
 * metadata, and every track's while a Library is mounted. Without `peaks`,
 * it decodes an overview of the current track once it has played. Use one
 * provider per page, since it owns navigator.mediaSession.
 *
 * Looks. A track's `look` is its waveform look: kevelle/waveform's
 * WaveformConfig as stored JSON. A look is a visualizer for its track, so
 * the block sets its source to "audio", and moves a screen form's own ratio
 * into the tones, since a form with its own ratio draws only tones: the
 * player screen draws the playing audio in the look's style. The look sets
 * everything else, its motion, display, light, and forms. A look that isn't
 * an object is dropped with the console warning, and the track draws the
 * default. Absent or null, a track draws the block's default player look,
 * the Paper card's 5:4 figure on the P31 screen, never the site's own look.
 *
 * useWavePlayer().look is the current track's look, else that default, and
 * never null, with source "audio". It keeps its object until the current
 * look's content changes, even across a fresh tracks array or a move
 * between two tracks with the same look, so a site memoizes
 * parseWaveformConfig(look) on it and parses nothing again.
 *
 * Screen. The card, the mini player, and the bar each own a square box that
 * stays dark in both themes. `screen` on the provider is what every frame's
 * box shows, from the first frame that mounts on the client, before the
 * first play included. It is one element for the provider's life: the block
 * mounts it with the first frame and moves it into whichever frame is
 * mounted, never remounting it, so the figure keeps its canvas and its
 * history across the card, the mini player, the bar, and pages with no
 * frame, where it sits outside the document and draws nothing. Without
 * `screen` every box is empty. The server renders the empty box, and the
 * figure fades in once its canvas starts. A spinner while a track loads and
 * an alert after it fails cover the box without replacing it. `screen`
 * renders under the provider, outside every frame, so it sees the contexts
 * above WavePlayerProvider and useWavePlayer(), and none set between the
 * provider and a frame.
 *
 * Hold. useWavePlayer().hold is what the screen's figure does, and the
 * block alone decides it from the status: null while a track plays, so it
 * draws the audio; "frozen" while it is paused or the system holds it, so
 * it stops where it stands; "still" before the first play, while a track
 * loads, after the last track ends, and after a failure, so it draws the
 * current look at rest. With kevelle/waveform, `screen` is a client
 * component that gives the player a WaveformProvider of its own, in the
 * current track's look, fed by the playing audio and held by `hold`, so the
 * site's own waveform keeps the site's look:
 *
 *   export function PlayerScreen() {
 *     const { feed, look, hold } = useWavePlayer()
 *     const config = useMemo(() => parseWaveformConfig(look), [look])
 *
 *     return (
 *       <WaveformProvider config={config} audio={feed} hold={hold} viewTransitionName={null}>
 *         <Waveform form="screen" className="size-full" />
 *       </WaveformProvider>
 *     )
 *   }
 *
 * Feed. useWavePlayer().feed is the playing audio, for whatever draws it.
 * It is null before the first play, while its tap loads, and when its
 * worklet fails, and a new one replaces it after an audio restart, so read
 * it on every render.
 *
 * Specimens. A page that shows several frames, such as a style guide,
 * passes `specimen` to all but one. A specimen never morphs and never takes
 * the provider's screen. Its box renders a copy of `screen` of its own,
 * where useWavePlayer().hold is "still" and feed is null, so it draws the
 * current look at rest. Each copy is another waveform with its own canvas
 * and GPU device, so only pages that show specimens pay for them.
 *
 * Active. useWavePlayer().active is true once the first play opens the
 * audio, while a track is current, until the last track ends. A pause, a
 * stopped load, and a failed track keep it true. It is false on the server.
 * It changes a render after `status`, in a transition, so a frame a host
 * mounts by it fades in when playback starts and out when it ends, with no
 * transition code in the host. Mount the mini player or the bar by `active`,
 * not by `status`: a status change commits at once and never animates.
 *
 *   const { active } = useWavePlayer()
 *   <aside>{active ? <WavePlayerMini expand={<Link href="/music" />} /> : null}</aside>
 *
 * Morph. The card, the mini player, and the bar draw one frame. Each wraps
 * it in React's <ViewTransition> named wave-player, so when a navigation or
 * any other transition unmounts one and mounts another, the frame morphs
 * from the old box to the new one with the browser's default animation.
 * The card arrives and leaves with its page; the mini player and the bar
 * fade in and out. The screen moves into the new box in the same commit,
 * so the morph carries the figure and the figure never restarts. Leave the
 * player's canvas unnamed, as viewTransitionName={null} does above, so it
 * rides inside the frame's morph: the site's own waveform already names its
 * canvas waveform, and two elements with one name stop every view
 * transition on the page.
 *
 * One frame per page. React allows one mounted <ViewTransition> per name,
 * and the browser skips a whole view transition when two rendered elements
 * share one. So render one frame view per page: the card on the music page,
 * and the mini player or the bar on the others. Pick between those two in
 * script with a media query, not a class that hides one, since a frame
 * hidden with CSS is still mounted and still named. Defer the query with
 * useDeferredValue so a breakpoint change runs as a transition and the
 * frame morphs.
 * A page that shows several frames, such as a style guide, passes
 * `specimen` to all but one. The props-only views carry no transition.
 *
 * Reduced motion. A frame that mounts under prefers-reduced-motion renders
 * no <ViewTransition>, so mounting it starts no view transition. A frame
 * the server rendered keeps its name and turns every trigger off. Either
 * way frames swap, appear, and leave at once, and the screen still moves.
 * A site's own transitions, and kevelle/waveform's, need the same switch,
 * and one already running when the preference changes needs CSS:
 *
 *   @media (prefers-reduced-motion: reduce) {
 *     ::view-transition-group(*), ::view-transition-old(*),
 *     ::view-transition-new(*) { animation-duration: 0s !important; }
 *   }
 *
 * Expand. The mini player's `expand` is the link its expand control renders
 * as, such as <Link href="/music" />, so client navigation keeps playing.
 * Without it there is no control. `className` on every view takes layout
 * classes only.
 *
 * Hosts. A cross-origin src needs an Access-Control-Allow-Origin header, or
 * the track fails to load. Under a Content-Security-Policy, the track host
 * goes in media-src and connect-src (the overview decode fetches the file),
 * and blob: in script-src for the feed's worklet.
 *
 * Keyboard. Every control is a button or the seek slider, which the card
 * and the mini player each have. Space plays and pauses in a focused view,
 * except on a control that takes Space itself. The seek slider moves 5 s with the arrows and 30 s with Page Up and Page
 * Down, and Home and End go to either end. Media keys go through Media
 * Session.
 *
 * Transport. Previous restarts the track after 3 s and otherwise goes back
 * one; on the first track it restarts. Next and Previous play the track they
 * land on, and Next is off on the last track. A track's end plays the next
 * one. The last track stays ended, and Play starts it again. Pause while a
 * track loads stops the load.
 */

import * as React from "react";
import { createPortal } from "react-dom";

import type { SampleFeed } from "@/lib/audio";

import { CardView } from "./card";
import { createScreenDock, type ScreenDock } from "./dock";
import type { WavePlayerLook } from "./look";
import type { Need, PlayerState, WavePlayerStatus } from "./model";
import { MiniView } from "./mini";
import { MobileBarView } from "./mobile-bar";
import {
  frameTransition,
  frameWraps,
  type FrameKind,
  type MountMotion,
} from "./morph";
import type { WavePlayerTrack } from "./playlist";
import { STATUS_VIEW, announcement, type WavePlayerHold } from "./status-view";
import { createPlayerStore, type PlayerStore } from "./store";
import { TrackListView } from "./track-list";

export type { WavePlayerLook } from "./look";

export type { WavePlayerStatus } from "./model";

export type { WavePlayerHold } from "./status-view";

export type { WavePlayerTrack } from "./playlist";

const PlayerContext = React.createContext<PlayerStore | null>(null);

/** The provider's screen element and its dock, or null when the provider has no `screen`. */
const ScreenContext = React.createContext<{
  readonly dock: ScreenDock;
  readonly element: React.ReactNode;
} | null>(null);

/** True inside a specimen's own copy of the screen. */
const SpecimenContext = React.createContext(false);

export type WavePlayerProviderProps = {
  readonly tracks: readonly WavePlayerTrack[];
  /**
   * What every frame's box shows, such as the site's own waveform. One
   * element for the provider's life: mounted with the first frame, moved
   * between frames, never remounted. A specimen renders a copy of its own.
   * Absent: every box is empty.
   */
  readonly screen?: React.ReactNode;
  readonly children: React.ReactNode;
};

export function WavePlayerProvider({
  tracks,
  screen,
  children,
}: WavePlayerProviderProps) {
  const [store] = React.useState(() => createPlayerStore(tracks));
  const [dock] = React.useState(() => createScreenDock(screenElement));

  const shown = React.useMemo(
    () => (screen == null ? null : { dock, element: screen }),
    [dock, screen]
  );

  React.useEffect(() => store.setTracks(tracks), [store, tracks]);
  React.useEffect(() => () => store.release(), [store]);

  return (
    <PlayerContext value={store}>
      <ScreenContext value={shown}>{children}</ScreenContext>
      {screen == null ? null : (
        <ScreenPortal dock={dock}>{screen}</ScreenPortal>
      )}
      <Announcer store={store} />
    </PlayerContext>
  );
}

/** The dock's element, a block that fills the frame's box. Made at the first hold, so only on the client. */
function screenElement(): HTMLElement {
  const element = document.createElement("div");

  element.dataset.slot = "wave-player-screen-content";

  return element;
}

/**
 * The site's screen, rendered into the dock's element: nothing until the
 * first frame holds it, then mounted for good. It renders here, under
 * the provider and outside every frame, so a frame's mount, unmount, or
 * remount never reaches it.
 */
function ScreenPortal({
  dock,
  children,
}: {
  readonly dock: ScreenDock;
  readonly children: React.ReactNode;
}) {
  const mounted = React.useSyncExternalStore(
    dock.subscribe,
    dock.mounted,
    () => false
  );

  return mounted ? createPortal(children, dock.element()) : null;
}

type WavePlayer = {
  /** The player's tap, for whatever draws the audio, such as kevelle/waveform's provider. */
  readonly feed: SampleFeed | null;
  readonly status: WavePlayerStatus;
  /**
   * Playback is under way, from the first play until the last track ends.
   * It changes a render after `status`, in a transition, so a frame a host
   * mounts or removes by it enters and exits with a view transition. False
   * on the server.
   */
  readonly active: boolean;
  /**
   * The current track's look, else the block's default player look, never
   * the site's. The same object until its content changes, so memoize
   * parseWaveformConfig(look) on it.
   */
  readonly look: WavePlayerLook;
  /**
   * For kevelle/waveform's provider `hold`: null while a track plays,
   * "frozen" where it stopped, "still" at rest. It changes in the render
   * `status` does. "still" in a specimen's copy of the screen.
   */
  readonly hold: WavePlayerHold | null;
};

/** The feed, the status, whether playback is under way, the current look, and the screen's hold, for site components under the provider. */
export function useWavePlayer(): WavePlayer {
  const store = useStore();
  const specimen = React.use(SpecimenContext);

  const feed = React.useSyncExternalStore(
    store.subscribe,
    () => store.getSnapshot().feed,
    () => null
  );

  const status = React.useSyncExternalStore(
    store.subscribe,
    () => store.getSnapshot().summary,
    () => store.getServerSnapshot().summary
  );

  const look = React.useSyncExternalStore(
    store.subscribe,
    () => store.getSnapshot().look,
    () => store.getServerSnapshot().look
  );

  const hold = React.useSyncExternalStore(
    store.subscribe,
    () => STATUS_VIEW[store.getSnapshot().status.kind].hold,
    () => STATUS_VIEW[store.getServerSnapshot().status.kind].hold
  );

  return {
    feed: specimen ? null : feed,
    status,
    active: useActive(store),
    look,
    hold: specimen ? "still" : hold,
  };
}

/**
 * The store notifies through useSyncExternalStore, whose renders are
 * synchronous and never start a view transition. The deferred copy
 * re-renders its readers in a transition lane, which does, so a host's
 * frame that follows it enters and exits in that lane.
 */
function useActive(store: PlayerStore): boolean {
  return React.useDeferredValue(
    React.useSyncExternalStore(
      store.subscribe,
      () => store.getSnapshot().active,
      () => false
    )
  );
}

type FrameProps = {
  /**
   * An extra frame, such as a style guide's. It never morphs, never takes
   * the provider's screen, and draws its own copy of `screen`, held still
   * on the current look. Read when the frame mounts. Default false.
   */
  readonly specimen?: boolean;
};

export type WavePlayerCardProps = FrameProps & {
  readonly className?: string;
};

export function WavePlayerCard({
  specimen = false,
  className,
}: WavePlayerCardProps) {
  const store = useStore();

  useNeed(store, "current");
  useNeed(store, "peaks");

  return (
    <Frame kind="card" specimen={specimen}>
      <CardView
        state={useSnapshot(store)}
        playhead={store.playhead}
        onCommand={store.send}
        screen={useScreen(specimen)}
        className={className}
      />
    </Frame>
  );
}

export type WavePlayerTracksProps = { readonly className?: string };

/** The Library. A row plays its track. */
export function WavePlayerTracks({ className }: WavePlayerTracksProps) {
  const store = useStore();

  useNeed(store, "durations");

  return (
    <TrackListView
      state={useSnapshot(store)}
      onCommand={store.send}
      className={className}
    />
  );
}

export type WavePlayerMiniProps = FrameProps & {
  /** The link the expand control renders as. The block adds the icon and the name "Open player". */
  readonly expand?: React.ReactElement;
  readonly className?: string;
};

export function WavePlayerMini({
  expand,
  specimen = false,
  className,
}: WavePlayerMiniProps) {
  const store = useStore();

  useNeed(store, "current");

  return (
    <Frame kind="mini" specimen={specimen}>
      <MiniView
        state={useSnapshot(store)}
        playhead={store.playhead}
        onCommand={store.send}
        screen={useScreen(specimen)}
        expand={expand}
        className={className}
      />
    </Frame>
  );
}

export type WavePlayerBarProps = FrameProps & {
  readonly className?: string;
};

export function WavePlayerBar({
  specimen = false,
  className,
}: WavePlayerBarProps) {
  const store = useStore();

  useNeed(store, "current");

  return (
    <Frame kind="bar" specimen={specimen}>
      <MobileBarView
        state={useSnapshot(store)}
        playhead={store.playhead}
        onCommand={store.send}
        screen={useScreen(specimen)}
        className={className}
      />
    </Frame>
  );
}

function useStore(): PlayerStore {
  const store = React.use(PlayerContext);

  if (!store)
    throw new Error(
      "WavePlayer views and useWavePlayer need a WavePlayerProvider above them."
    );

  return store;
}

function useSnapshot(store: PlayerStore): PlayerState {
  return React.useSyncExternalStore(
    store.subscribe,
    store.getSnapshot,
    store.getServerSnapshot
  );
}

/** Holds a view's need while it is mounted, which is what lets the store skip work nobody draws. */
function useNeed(store: PlayerStore, need: Need): void {
  React.useEffect(() => store.retain(need), [store, need]);
}

/**
 * The box's content: the dock in a frame, a still copy of the screen in a
 * specimen, and nothing without `screen`. Which one is read when the frame
 * mounts, so a mounted frame never swaps its box's content.
 */
function useScreen(specimen: boolean): React.ReactNode {
  const screen = React.use(ScreenContext);
  const [copy] = React.useState(specimen);

  if (screen === null) return undefined;

  return copy ? (
    <SpecimenContext value>{screen.element}</SpecimenContext>
  ) : (
    <Dock dock={screen.dock} />
  );
}

/**
 * Holds the screen in this box from a layout effect, inside the commit that
 * mounts the frame, so a view transition captures it in its new box. React
 * renders no children here, so it never touches the element the dock
 * appends.
 */
function Dock({ dock }: { readonly dock: ScreenDock }) {
  const box = React.useRef<HTMLDivElement>(null);

  React.useLayoutEffect(
    () => (box.current ? dock.hold(box.current) : undefined),
    [dock]
  );

  return (
    <div
      ref={box}
      data-slot="wave-player-dock"
      className="size-full *:size-full"
    />
  );
}

/**
 * A frame view inside its <ViewTransition>, or bare where it may not
 * animate (#208). The wrapper is chosen once, from `specimen` and the
 * preference the frame mounted under, so a mounted frame never changes
 * element type and never remounts its view. Its triggers follow the live
 * preference.
 */
function Frame({
  kind,
  specimen,
  children,
}: {
  readonly kind: FrameKind;
  readonly specimen: boolean;
  readonly children: React.ReactElement;
}) {
  const motion = useMotion();
  const [wraps] = React.useState(() => frameWraps(!specimen, motion));

  return wraps ? (
    <React.ViewTransition {...frameTransition(kind, motion !== "full")}>
      {children}
    </React.ViewTransition>
  ) : (
    children
  );
}

const REDUCED_MOTION = "(prefers-reduced-motion: reduce)";

/**
 * "unknown" on the server and through hydration, so a server-rendered
 * frame wraps as the server's markup does and animates nothing until the
 * preference is known. A frame that mounts on the client reads the real
 * preference on its first render.
 */
function useMotion(): MountMotion {
  return React.useSyncExternalStore(
    subscribeReducedMotion,
    () => (matchMedia(REDUCED_MOTION).matches ? "reduced" : "full"),
    () => "unknown"
  );
}

function subscribeReducedMotion(listener: () => void): () => void {
  const query = matchMedia(REDUCED_MOTION);

  query.addEventListener("change", listener);

  return () => query.removeEventListener("change", listener);
}

/** The page's one live region for the player, so three mounted views announce a change once. */
function Announcer({ store }: { readonly store: PlayerStore }) {
  const status = React.useSyncExternalStore(
    store.subscribe,
    () => store.getSnapshot().summary,
    () => store.getServerSnapshot().summary
  );

  return (
    <p aria-live="polite" aria-atomic="true" className="sr-only">
      {announcement(status)}
    </p>
  );
}
