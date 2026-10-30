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
 *   <WavePlayerProvider tracks={tracks}>{children}</WavePlayerProvider>
 *
 *   <WavePlayerCard screen={<PlayerScreen />} />           the 340 wide card
 *   <WavePlayerTracks />                                   the Library list
 *   <WavePlayerMini screen={<PlayerScreen />} expand={<Link href="/music" />} />
 *   <WavePlayerBar screen={<PlayerScreen />} className="fixed inset-x-3 bottom-8" />
 *
 *   const { feed, status, active } = useWavePlayer()
 *
 * Provider. Put it where it outlives navigation, such as a Next.js root
 * layout. Playback lives there, so views mount and unmount freely. `tracks`
 * is plain data a server component can pass, in play order: { id, title,
 * src, artist?, record?, tag?, duration?, peaks? }. Each id is stable and
 * unique. A record the player can't use is dropped with one console warning,
 * never thrown, and a fresh array of the same tracks changes nothing.
 * Without `duration`, the player reads the current track's metadata, and
 * every track's while a Library is mounted. Without `peaks`, it decodes an
 * overview of the current track once it has played. Use one provider per
 * page, since it owns navigator.mediaSession.
 *
 * Screen. The card, the mini player, and the bar each own a square box that
 * stays dark in both themes. `screen` content fills the box and knows
 * nothing about the view. Without it the box draws a still 5:4 Lissajous
 * figure. The content stays mounted in every status: a spinner while a
 * track loads and an alert after it fails cover it without replacing it.
 *
 * Feed. useWavePlayer().feed is the playing audio, for whatever draws it.
 * With kevelle/waveform, a client component under this provider passes it
 * to WaveformProvider's `audio`, and the slot holds a plain
 * <Waveform form="screen" className="size-full" />. The feed is null
 * before the first play, while its tap loads, and when its worklet fails,
 * and a new one replaces it after an audio restart, so read it on every
 * render.
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
 * fade in and out. A screen whose canvas carries its own transition name
 * moves with the frame and keeps drawing. kevelle/waveform names its live
 * canvas waveform, and this block never names it.
 *
 * One frame per page. React allows one mounted <ViewTransition> per name,
 * and the browser skips a whole view transition when two rendered elements
 * share one. So render one frame view per page: the card on the music page,
 * and the mini player or the bar on the others. Pick between those two in
 * script with a media query, not a class that hides one, since a frame
 * hidden with CSS is still mounted and still named. Defer the query with
 * useDeferredValue so a breakpoint change runs as a transition and the
 * frame morphs, as the block page's Site demo does with Wide and Narrow.
 * A page that shows several frames, such as a style guide, passes
 * morph={false} to all but one. The props-only views carry no transition.
 *
 * Reduced motion. Under prefers-reduced-motion the frames keep the name and
 * turn every trigger off, so they swap, appear, and leave at once. A site's
 * own transitions, and kevelle/waveform's, need the same switch.
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
 * Keyboard. Every control is a button or the seek slider. Space plays and
 * pauses in a focused view, except on a control that takes Space itself.
 * The seek slider moves 5 s with the arrows and 30 s with Page Up and Page
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

import type { SampleFeed } from "@/lib/audio";

import { CardView } from "./card";
import type { Need, PlayerState, WavePlayerStatus } from "./model";
import { MiniView } from "./mini";
import { MobileBarView } from "./mobile-bar";
import { frameTransition, type FrameKind, type FrameTransition } from "./morph";
import type { WavePlayerTrack } from "./playlist";
import { announcement } from "./status-view";
import { createPlayerStore, type PlayerStore } from "./store";
import { TrackListView } from "./track-list";

export type { WavePlayerStatus } from "./model";

export type { WavePlayerTrack } from "./playlist";

const PlayerContext = React.createContext<PlayerStore | null>(null);

export type WavePlayerProviderProps = {
  readonly tracks: readonly WavePlayerTrack[];
  readonly children: React.ReactNode;
};

export function WavePlayerProvider({
  tracks,
  children,
}: WavePlayerProviderProps) {
  const [store] = React.useState(() => createPlayerStore(tracks));

  React.useEffect(() => store.setTracks(tracks), [store, tracks]);
  React.useEffect(() => () => store.release(), [store]);

  return (
    <PlayerContext value={store}>
      {children}
      <Announcer store={store} />
    </PlayerContext>
  );
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
};

/** The feed, the status, and whether playback is under way, for site components under the provider. */
export function useWavePlayer(): WavePlayer {
  const store = useStore();

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

  // The store notifies through useSyncExternalStore, whose renders are
  // synchronous and never start a view transition. The deferred copy
  // re-renders its readers in a transition lane, which does.
  const active = React.useDeferredValue(
    React.useSyncExternalStore(
      store.subscribe,
      () => store.getSnapshot().active,
      () => false
    )
  );

  return { feed, status, active };
}

type FrameProps = {
  /**
   * The frame morphs to and from the other frame views through a view
   * transition named wave-player. Mount one morphing frame at a time; pass
   * false on extra frames, such as a style guide's. Default true.
   */
  readonly morph?: boolean;
};

export type WavePlayerCardProps = FrameProps & {
  /** Fills the 308px square. Absent: the still figure. */
  readonly screen?: React.ReactNode;
  readonly className?: string;
};

export function WavePlayerCard({
  screen,
  morph = true,
  className,
}: WavePlayerCardProps) {
  const store = useStore();

  useNeed(store, "current");
  useNeed(store, "peaks");

  return (
    <React.ViewTransition {...useFrameTransition("card", morph)}>
      <CardView
        state={useSnapshot(store)}
        playhead={store.playhead}
        onCommand={store.send}
        screen={screen}
        className={className}
      />
    </React.ViewTransition>
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
  /** Fills the square, which is as wide as the container minus 24px. Absent: the still figure. */
  readonly screen?: React.ReactNode;
  /** The link the expand control renders as. The block adds the icon and the name "Open player". */
  readonly expand?: React.ReactElement;
  readonly className?: string;
};

export function WavePlayerMini({
  screen,
  expand,
  morph = true,
  className,
}: WavePlayerMiniProps) {
  const store = useStore();

  useNeed(store, "current");
  useNeed(store, "peaks");

  return (
    <React.ViewTransition {...useFrameTransition("mini", morph)}>
      <MiniView
        state={useSnapshot(store)}
        playhead={store.playhead}
        onCommand={store.send}
        screen={screen}
        expand={expand}
        className={className}
      />
    </React.ViewTransition>
  );
}

export type WavePlayerBarProps = FrameProps & {
  /** Fills the 36px square. Absent: the still figure without its afterglow. */
  readonly screen?: React.ReactNode;
  readonly className?: string;
};

export function WavePlayerBar({
  screen,
  morph = true,
  className,
}: WavePlayerBarProps) {
  const store = useStore();

  useNeed(store, "current");

  return (
    <React.ViewTransition {...useFrameTransition("bar", morph)}>
      <MobileBarView
        state={useSnapshot(store)}
        playhead={store.playhead}
        onCommand={store.send}
        screen={screen}
        className={className}
      />
    </React.ViewTransition>
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

const REDUCED_MOTION = "(prefers-reduced-motion: reduce)";

function useFrameTransition(kind: FrameKind, morph: boolean): FrameTransition {
  return frameTransition(kind, { morph, reduced: useReducedMotion() });
}

/**
 * True on the server and through hydration, so nothing animates before the
 * preference is known. Hydration runs no view transitions, so the server
 * value only fills the first render.
 */
function useReducedMotion(): boolean {
  return React.useSyncExternalStore(
    subscribeReducedMotion,
    () => matchMedia(REDUCED_MOTION).matches,
    () => true
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
