import type { FailReason, StatusKind, WavePlayerStatus } from "./model";

/** A status Badge: the machine's voice, in caps, as the oscilloscope's stage badge is. */
export type StatusBadge = {
  readonly label: string;
  readonly variant: "secondary" | "outline" | "warning" | "destructive";
};

export type StatusView = {
  /** The center button's glyph. */
  readonly glyph: "play" | "pause" | "retry";
  /** The center button's accessible name. */
  readonly label: "Play" | "Pause" | "Replay" | "Retry";
  /** False after a failure: every time readout shows --:--. */
  readonly times: boolean;
  /** A seek applies now, or once the track loads. */
  readonly seekable: boolean;
  /** Playback has run for this track, so the block may decode its peaks. */
  readonly started: boolean;
  /** Media Session's playbackState. */
  readonly session: MediaSessionPlaybackState;
  /** Null where the transport already says it all. */
  readonly badge: StatusBadge | null;
  /**
   * What covers the screen slot: a spinner while the track loads, or the
   * failure's Alert. The slot's content stays mounted under it.
   */
  readonly overlay: "spinner" | "failure" | null;
};

export const STATUS_VIEW = {
  idle: {
    glyph: "play",
    label: "Play",
    times: true,
    seekable: true,
    started: false,
    session: "none",
    badge: null,
    overlay: null,
  },
  loading: {
    glyph: "pause",
    label: "Pause",
    times: true,
    seekable: true,
    started: false,
    session: "playing",
    badge: { label: "LOADING", variant: "secondary" },
    overlay: "spinner",
  },
  playing: {
    glyph: "pause",
    label: "Pause",
    times: true,
    seekable: true,
    started: true,
    session: "playing",
    badge: null,
    overlay: null,
  },
  paused: {
    glyph: "play",
    label: "Play",
    times: true,
    seekable: true,
    started: true,
    session: "paused",
    badge: null,
    overlay: null,
  },
  blocked: {
    glyph: "play",
    label: "Play",
    times: true,
    seekable: true,
    started: false,
    session: "paused",
    badge: { label: "HOLD", variant: "warning" },
    overlay: null,
  },
  ended: {
    glyph: "play",
    label: "Replay",
    times: true,
    seekable: true,
    started: true,
    session: "paused",
    badge: { label: "ENDED", variant: "outline" },
    overlay: null,
  },
  failed: {
    glyph: "retry",
    label: "Retry",
    times: false,
    seekable: false,
    started: false,
    session: "none",
    badge: { label: "FAULT", variant: "destructive" },
    overlay: "failure",
  },
} as const satisfies Record<StatusKind, StatusView>;

/** The Alert over a failed track's screen. Retry is offered where pressing it can help. */
export const FAILURE = {
  load: {
    title: "Couldn't load the track",
    description:
      "The file may be missing, blocked by its host, or in a format this browser can't play.",
    retry: true,
  },
  audio: {
    title: "Audio stopped",
    description: "The page's audio stopped working. Retry starts it again.",
    retry: true,
  },
  unsupported: {
    title: "No Web Audio",
    description: "This browser can't play audio.",
    retry: false,
  },
} as const satisfies Record<
  FailReason,
  {
    readonly title: string;
    readonly description: string;
    readonly retry: boolean;
  }
>;

/**
 * The live region's sentence. Loading, playing, and paused share "Now
 * playing <title>", so pause and resume stay quiet and a track change speaks
 * once. A failure says the track couldn't load and never that it isn't
 * audio, since Chromium reports a 404, a host without CORS, and an
 * undecodable file the same way. Empty when there is nothing to say.
 */
export function announcement(status: WavePlayerStatus): string {
  if (status.kind === "empty") return "";

  const title = status.track.title;

  switch (status.kind) {
    case "idle":
      return "";
    case "loading":
    case "playing":
    case "paused":
      return `Now playing ${title}`;
    case "blocked":
      return `Press Play to hear ${title}.`;
    case "ended":
      return `Finished ${title}.`;
    case "failed":
      switch (status.reason) {
        case "load":
          return `Couldn't load ${title}.`;
        case "audio":
          return "Audio stopped working. Press Retry to try again.";
        case "unsupported":
          return "This browser can't play audio.";
        default:
          return status.reason satisfies never;
      }

    default:
      return status satisfies never;
  }
}
