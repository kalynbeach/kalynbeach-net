import { toSeconds, type Seconds } from "@/lib/audio";

import { hasNext, type PlayerCommand, type PlayerState } from "./model";
import { STATUS_VIEW } from "./status-view";

export type NowPlayingView = {
  readonly metadata: {
    readonly title: string;
    readonly artist: string;
    readonly album: string;
  } | null;
  readonly playbackState: MediaSessionPlaybackState;
  /** Null while the duration is unknown, since setPositionState() throws without one. */
  readonly position: {
    readonly duration: Seconds;
    readonly position: Seconds;
  } | null;
  /** The OS shows a next-track control. False on the last track. */
  readonly next: boolean;
};

export function describeNowPlaying(
  state: PlayerState,
  position: Seconds
): NowPlayingView {
  const current = state.current;

  if (!current)
    return {
      metadata: null,
      playbackState: "none",
      position: null,
      next: false,
    };

  const duration =
    state.status.kind === "failed" ? null : current.track.duration;

  return {
    metadata: {
      title: current.track.title,
      artist: current.track.artist ?? "",
      album: current.track.record ?? "",
    },
    playbackState: STATUS_VIEW[state.status.kind].session,
    position:
      duration === null
        ? null
        : { duration, position: toSeconds(Math.min(position, duration)) },
    next: hasNext(state),
  };
}

export type NowPlaying = {
  /** Writes the difference from the last view, and the position every time. */
  render(view: NowPlayingView): void;
  /** Removes every handler, clears the metadata, and sets the state to "none". */
  clear(): void;
};

/**
 * The adapter over navigator.mediaSession, or a no-op without one. Each
 * handler sends an explicit command, so a stray OS "play" never pauses.
 * The store calls render() on every commit, never per frame; the OS
 * advances the position between calls on its own.
 */
export function createNowPlaying(
  session: MediaSession | null,
  send: (command: PlayerCommand) => void
): NowPlaying {
  if (!session) return { render: () => {}, clear: () => {} };

  const handlers: readonly (readonly [
    MediaSessionAction,
    MediaSessionActionHandler,
  ])[] = [
    ["play", () => send({ type: "play" })],
    ["pause", () => send({ type: "pause" })],
    ["previoustrack", () => send({ type: "previous" })],
    [
      "seekto",
      (details) => {
        if (details.seekTime !== undefined)
          send({ type: "seek", to: details.seekTime });
      },
    ],
  ];

  const next: MediaSessionActionHandler = () => send({ type: "next" });
  let shown: NowPlayingView | null = null;

  // Browsers throw for an action they do not support.
  function setHandler(
    action: MediaSessionAction,
    handler: MediaSessionActionHandler | null
  ): void {
    try {
      session?.setActionHandler(action, handler);
    } catch {}
  }

  // Browsers throw for a position past the duration, as a seek near the end can briefly report.
  function setPosition(state?: MediaPositionState): void {
    try {
      session?.setPositionState(state);
    } catch {}
  }

  return {
    render(view) {
      if (!shown)
        for (const [action, handler] of handlers) setHandler(action, handler);

      const metadata = view.metadata;

      if (
        !shown ||
        shown.metadata?.title !== metadata?.title ||
        shown.metadata?.artist !== metadata?.artist ||
        shown.metadata?.album !== metadata?.album
      )
        session.metadata = metadata ? new MediaMetadata(metadata) : null;

      if (shown?.playbackState !== view.playbackState)
        session.playbackState = view.playbackState;

      if (!shown || shown.next !== view.next)
        setHandler("nexttrack", view.next ? next : null);

      // With no argument, setPositionState() clears the last track's
      // position, which the OS would otherwise keep showing.
      if (view.position) setPosition({ ...view.position, playbackRate: 1 });
      else if (shown?.position) setPosition();

      shown = view;
    },
    clear() {
      for (const [action] of handlers) setHandler(action, null);

      setHandler("nexttrack", null);
      setPosition();
      session.metadata = null;
      session.playbackState = "none";
      shown = null;
    },
  };
}
