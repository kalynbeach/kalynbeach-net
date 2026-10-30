import {
  toSeconds,
  type FeedError,
  type Result,
  type SampleFeed,
  type Seconds,
  type SourceError,
  type SourceStatus,
  type StationSnapshot,
} from "@/lib/audio";

import type { Peaks } from "./peaks";
import type { Playlist } from "./playlist";
import { STATUS_VIEW } from "./status-view";

export type FailReason =
  /** The track did not load: a network error, a 404, a host without CORS, or a file the browser can't decode. */
  | "load"
  /** The page's audio context failed or closed. */
  | "audio"
  /** No Web Audio or AudioWorklet, or an insecure page. */
  | "unsupported";

/**
 * What the current track is doing, merged from the strip, the station, and
 * support. Each value is one shared constant, so a status keeps its identity
 * until it changes.
 */
export type PlayerStatus =
  /** Nothing loaded: before the first play, after a cancel, or after the list dropped the track. */
  | { readonly kind: "idle" }
  /** The strip is opening the track. */
  | { readonly kind: "loading" }
  | { readonly kind: "playing" }
  | { readonly kind: "paused" }
  /**
   * The browser refused to start without a gesture, or the system holds the
   * context under a playing track. The next press of Play retries.
   */
  | { readonly kind: "blocked" }
  /** The last track finished and stays current. Play starts it again. */
  | { readonly kind: "ended" }
  | { readonly kind: "failed"; readonly reason: FailReason };

export type StatusKind = PlayerStatus["kind"];

const IDLE: PlayerStatus = { kind: "idle" };

const LOADING: PlayerStatus = { kind: "loading" };

const PLAYING: PlayerStatus = { kind: "playing" };

const PAUSED: PlayerStatus = { kind: "paused" };

const BLOCKED: PlayerStatus = { kind: "blocked" };

const ENDED: PlayerStatus = { kind: "ended" };

const FAILED = {
  load: { kind: "failed", reason: "load" },
  audio: { kind: "failed", reason: "audio" },
  unsupported: { kind: "failed", reason: "unsupported" },
} as const satisfies Record<FailReason, PlayerStatus>;

/** A track as the views show it. No src and no raw peaks; those stay in the store. */
export type TrackInfo = {
  readonly id: string;
  readonly title: string;
  readonly artist: string | null;
  readonly record: string | null;
  readonly tag: string | null;
  /** The site's, else the playing element's, else one the element heard earlier, else a probe's. Null until one is known. */
  readonly duration: Seconds | null;
};

export type CurrentTrack = {
  readonly index: number;
  /** The same object as tracks[index]. */
  readonly track: TrackInfo;
  /** The site's peaks, else decoded ones. Null until either exists; the seek bar then draws uniform low bars. */
  readonly peaks: Peaks | null;
};

/** The current track as useWavePlayer() reports it. */
export type WavePlayerTrackInfo = {
  readonly id: string;
  readonly title: string;
  readonly artist: string | null;
  readonly record: string | null;
  /** From 0. */
  readonly index: number;
  readonly count: number;
};

/** What useWavePlayer() reports: "empty" with no tracks, else the status and the current track. */
export type WavePlayerStatus =
  | { readonly kind: "empty" }
  | {
      readonly kind: Exclude<StatusKind, "failed">;
      readonly track: WavePlayerTrackInfo;
    }
  | {
      readonly kind: "failed";
      readonly reason: FailReason;
      readonly track: WavePlayerTrackInfo;
    };

const EMPTY: WavePlayerStatus = { kind: "empty" };

/**
 * The snapshot the store publishes. getSnapshot() returns the same object
 * until a field changes, and an unchanged row in `tracks` keeps its identity.
 */
export type PlayerState = {
  readonly tracks: readonly TrackInfo[];
  /** Null exactly when `tracks` is empty. */
  readonly current: CurrentTrack | null;
  readonly status: PlayerStatus;
  /** The strip's tap. Null with no context yet, while the tap loads, or when its worklet failed. */
  readonly feed: SampleFeed | null;
  /** The public status, kept stable while its fields are. */
  readonly summary: WavePlayerStatus;
  /**
   * Playback is under way: the first sounding gesture opened the strip, a
   * track is current, and the last track has not ended. A pause, a cancelled
   * load, and a failed track keep it, so Retry and Next stay where the
   * listener can reach them. A browser without Web Audio never opens the
   * strip, so it never turns true. Replay after the end turns it true again.
   * Hosts mount the mini player and the bar by it, through useWavePlayer().
   */
  readonly active: boolean;
};

/** Everything deriveState() reads. The store assembles it; the states workbench builds it by hand. */
export type StoreInputs = {
  readonly playlist: Playlist;
  /** Null exactly when the playlist is empty. */
  readonly index: number | null;
  /** The strip's status, or { kind: "none" } before the first play. */
  readonly source: SourceStatus;
  /** Null until the first play opens the strip. */
  readonly station: StationSnapshot | null;
  readonly feed: Result<SampleFeed, FeedError> | null;
  /** The first play found no Web Audio. */
  readonly unsupported: boolean;
  /**
   * A load asked the element to play, and the strip has not yet reported it
   * playing, blocked, ended, or failed. The strip reports "paused" from the
   * track's metadata until its first `playing` event, which this reads as
   * still loading.
   */
  readonly awaitingPlay: boolean;
  readonly heard: ReadonlyMap<string, Seconds>;
  readonly probed: ReadonlyMap<string, Seconds>;
  readonly decoded: ReadonlyMap<string, Peaks>;
};

/** Builds the snapshot, reusing `previous` and its rows wherever nothing changed. */
export function deriveState(
  inputs: StoreInputs,
  previous: PlayerState | null
): PlayerState {
  const status = deriveStatus(inputs);

  const playing = inputs.source.kind === "file" ? inputs.source.duration : null;

  const rows = inputs.playlist.tracks.map((track, index) => {
    const row: TrackInfo = {
      id: track.id,
      title: track.title,
      artist: track.artist,
      record: track.record,
      tag: track.tag,
      duration:
        track.duration ??
        (index === inputs.index ? playing : null) ??
        inputs.heard.get(track.id) ??
        inputs.probed.get(track.id) ??
        null,
    };

    const old = previous?.tracks[index];

    return old && sameRow(old, row) ? old : row;
  });

  const tracks =
    previous &&
    rows.length === previous.tracks.length &&
    rows.every((row, index) => row === previous.tracks[index])
      ? previous.tracks
      : rows;

  const current = currentTrack(inputs, tracks, previous?.current ?? null);
  const feed = inputs.feed?.ok ? inputs.feed.value : null;
  const summary = summarize(status, current, tracks.length, previous);

  const active =
    inputs.station !== null && current !== null && status.kind !== "ended";

  if (
    previous &&
    previous.tracks === tracks &&
    previous.current === current &&
    previous.status === status &&
    previous.feed === feed &&
    previous.summary === summary &&
    previous.active === active
  )
    return previous;

  return { tracks, current, status, feed, summary, active };
}

function sameRow(a: TrackInfo, b: TrackInfo): boolean {
  return (
    a.id === b.id &&
    a.title === b.title &&
    a.artist === b.artist &&
    a.record === b.record &&
    a.tag === b.tag &&
    a.duration === b.duration
  );
}

function currentTrack(
  inputs: StoreInputs,
  tracks: readonly TrackInfo[],
  previous: CurrentTrack | null
): CurrentTrack | null {
  if (inputs.index === null) return null;

  const track = tracks[inputs.index];
  const source = inputs.playlist.tracks[inputs.index];

  const peaks = source.peaks ?? inputs.decoded.get(source.id) ?? null;

  if (
    previous &&
    previous.index === inputs.index &&
    previous.track === track &&
    previous.peaks === peaks
  )
    return previous;

  return { index: inputs.index, track, peaks };
}

function summarize(
  status: PlayerStatus,
  current: CurrentTrack | null,
  count: number,
  previous: PlayerState | null
): WavePlayerStatus {
  if (!current) return EMPTY;

  const old = previous?.summary;

  if (
    old &&
    old.kind !== "empty" &&
    previous?.status === status &&
    old.track.id === current.track.id &&
    old.track.title === current.track.title &&
    old.track.artist === current.track.artist &&
    old.track.record === current.track.record &&
    old.track.index === current.index &&
    old.track.count === count
  )
    return old;

  const track: WavePlayerTrackInfo = {
    id: current.track.id,
    title: current.track.title,
    artist: current.track.artist,
    record: current.track.record,
    index: current.index,
    count,
  };

  return status.kind === "failed"
    ? { kind: "failed", reason: status.reason, track }
    : { kind: status.kind, track };
}

/**
 * Merges support, the strip, and the station, in this order: unsupported, a
 * failed source, a failed station, then the source's own state. A playing
 * element under a context the system holds reads "blocked", since only a
 * gesture brings the sound back. A loaded track that has not started yet
 * reads "loading", not "paused".
 */
export function deriveStatus({
  source,
  station,
  unsupported,
  awaitingPlay,
}: Pick<
  StoreInputs,
  "source" | "station" | "unsupported" | "awaitingPlay"
>): PlayerStatus {
  if (unsupported) return FAILED.unsupported;

  if (source.kind === "failed") return FAILED[failReason(source.error)];

  if (station?.state === "failed") return FAILED.audio;

  switch (source.kind) {
    case "none":
    case "tones":
    case "input":
      return IDLE;
    case "connecting":
      return LOADING;
    case "file":
      switch (source.playback) {
        case "blocked":
          return BLOCKED;
        case "playing":
          return station?.state === "suspended" && station.by === "system"
            ? BLOCKED
            : PLAYING;
        case "paused":
          return awaitingPlay ? LOADING : PAUSED;
        case "ended":
          return ENDED;
        default:
          return source.playback satisfies never;
      }

    default:
      return source satisfies never;
  }
}

/** "station-not-running" is the context's failure; every other error means the track didn't load. */
export function failReason(error: SourceError): FailReason {
  return error.kind === "station-not-running" ? "audio" : "load";
}

/** Next is enabled: a track follows the current one. */
export function hasNext(state: PlayerState): boolean {
  return (
    state.current !== null && state.current.index < state.tracks.length - 1
  );
}

/**
 * Everything a person, a key, or Media Session can ask for. Views call
 * onCommand, and Media Session handlers call the same store.send().
 */
export type PlayerCommand =
  /** The center button and Space. */
  | { readonly type: "toggle" }
  /** Media Session's play and pause, which must not toggle. */
  | { readonly type: "play" }
  | { readonly type: "pause" }
  | { readonly type: "next" }
  | { readonly type: "previous" }
  /** A Library row. An unknown id does nothing. */
  | { readonly type: "play-track"; readonly id: string }
  /** Seconds. The plan clamps it into the track. */
  | { readonly type: "seek"; readonly to: number };

/** Previous restarts the track when the position is past this, strictly; at 3.0 s it goes back a track. */
export const RESTART_AFTER = 3;

/** What the store knows when a command arrives. */
export type Situation = {
  readonly index: number;
  /** At least 1: the store drops commands on an empty playlist. */
  readonly count: number;
  readonly status: StatusKind;
  /** Read from the file handle when the command arrives, not from the last frame. */
  readonly position: number;
  readonly duration: Seconds | null;
  /** A file handle exists for the current track. */
  readonly loaded: boolean;
  readonly indexOf: ReadonlyMap<string, number>;
};

/**
 * What the store does to the strip. "load" is the only effect that changes
 * the strip's source, and it always plays the track at the plan's index.
 */
export type Effect =
  | { readonly kind: "none" }
  /** strip.play() for the plan's track, from 0 or from a seek made before it loaded. */
  | { readonly kind: "load" }
  /** handle.play(): from the paused position, or from the top after the end. Loads when no handle exists. */
  | { readonly kind: "resume" }
  /** handle.seek(0), then handle.play(). Loads when no handle exists. */
  | { readonly kind: "restart" }
  | { readonly kind: "pause" }
  /** strip.stop() on a track still loading. It stays current, idle. */
  | { readonly kind: "cancel" }
  /** handle.seek(), or held until the track loads. */
  | { readonly kind: "seek"; readonly to: Seconds };

export type Plan = { readonly index: number; readonly effect: Effect };

const NONE: Effect = { kind: "none" };

const LOAD: Effect = { kind: "load" };

const RESUME: Effect = { kind: "resume" };

const RESTART: Effect = { kind: "restart" };

const PAUSE: Effect = { kind: "pause" };

const CANCEL: Effect = { kind: "cancel" };

const TOGGLE = {
  idle: LOAD,
  loading: CANCEL,
  playing: PAUSE,
  paused: RESUME,
  blocked: RESUME,
  ended: RESUME,
  failed: LOAD,
} as const satisfies Record<StatusKind, Effect>;

const CURRENT_ROW = {
  idle: LOAD,
  loading: NONE,
  playing: NONE,
  paused: RESUME,
  blocked: RESUME,
  ended: RESTART,
  failed: LOAD,
} as const satisfies Record<StatusKind, Effect>;

/**
 * The transport rules:
 *
 *   toggle      TOGGLE above
 *   play        as toggle, but nothing while loading or playing
 *   pause       playing pauses, loading cancels, otherwise nothing
 *   next        the next track, playing, even from paused; nothing on the last track
 *   previous    more than 3 s into a loaded track restarts it; otherwise the
 *               previous track, playing; the first track restarts, or loads
 *               when it has not loaded yet
 *   play-track  another track loads it; the current one follows CURRENT_ROW
 *   seek        clamped into [0, duration], while the status allows seeking
 *
 * Next and previous always end up playing: each arrives in a gesture, so
 * the play is allowed, and no "cued but silent" state exists.
 */
export function planCommand(command: PlayerCommand, at: Situation): Plan {
  const stay = (effect: Effect): Plan => ({ index: at.index, effect });

  switch (command.type) {
    case "toggle":
      return stay(TOGGLE[at.status]);
    case "play":
      return stay(
        at.status === "loading" || at.status === "playing"
          ? NONE
          : TOGGLE[at.status]
      );
    case "pause":
      return stay(
        at.status === "playing"
          ? PAUSE
          : at.status === "loading"
            ? CANCEL
            : NONE
      );
    case "next":
      return at.index < at.count - 1
        ? { index: at.index + 1, effect: LOAD }
        : stay(NONE);
    case "previous":
      if (at.loaded && at.position > RESTART_AFTER) return stay(RESTART);

      if (at.index > 0) return { index: at.index - 1, effect: LOAD };

      return stay(at.loaded ? RESTART : LOAD);
    case "play-track": {
      const index = at.indexOf.get(command.id);

      if (index === undefined) return stay(NONE);

      return index === at.index
        ? stay(CURRENT_ROW[at.status])
        : { index, effect: LOAD };
    }

    case "seek":
      if (!STATUS_VIEW[at.status].seekable) return stay(NONE);

      return stay({
        kind: "seek",
        to: toSeconds(
          Math.min(
            at.duration ?? Infinity,
            Math.max(0, Number.isFinite(command.to) ? command.to : 0)
          )
        ),
      });
    default:
      return command satisfies never;
  }
}

/**
 * The strip reported the current track's end. Load the next one when it
 * exists; on the last track stay, so the status reads ended.
 */
export function planEnded(at: Pick<Situation, "index" | "count">): Plan {
  return at.index < at.count - 1
    ? { index: at.index + 1, effect: LOAD }
    : { index: at.index, effect: NONE };
}

/** The effect makes sound, so the store opens the strip and starts the station first, in the same gesture. */
export function startsAudio(effect: Effect): boolean {
  return (
    effect.kind === "load" ||
    effect.kind === "resume" ||
    effect.kind === "restart"
  );
}

/** A duration probe or a peaks decode for one track. */
export type Load =
  | { readonly kind: "duration"; readonly id: string }
  | { readonly kind: "peaks"; readonly id: string };

/**
 * What the mounted views need. "durations": every track's duration (the
 * Library). "current": the current track's duration (every other view).
 * "peaks": the current track's peaks (the seek bars).
 */
export type Need = "durations" | "current" | "peaks";

export type Demand = Readonly<Record<Need, boolean>>;

/** "duration:<id>" or "peaks:<id>": the key for running loads and for loads that failed. */
export function loadKey(load: Load): string {
  return `${load.kind}:${load.id}`;
}

/**
 * The loads the store should run, in priority order. The store starts what
 * is missing and aborts what is no longer listed, so reconciling twice
 * changes nothing.
 *
 *   durations  the current track's while it sits idle without one (once
 *              loading, the element reports it), then, for the Library,
 *              every other track without one
 *   peaks      the current track's, without peaks, once playback has run
 *
 * A load that failed or timed out stays failed for the page.
 */
export function wantedLoads(
  state: PlayerState,
  demand: Demand,
  failed: ReadonlySet<string>
): readonly Load[] {
  const current = state.current;
  const loads: Load[] = [];

  if (
    current &&
    (demand.current || demand.durations) &&
    current.track.duration === null &&
    state.status.kind === "idle"
  )
    loads.push({ kind: "duration", id: current.track.id });

  if (demand.durations)
    state.tracks.forEach((track, index) => {
      if (track.duration === null && index !== current?.index)
        loads.push({ kind: "duration", id: track.id });
    });

  if (
    current &&
    demand.peaks &&
    current.peaks === null &&
    STATUS_VIEW[state.status.kind].started
  )
    loads.push({ kind: "peaks", id: current.track.id });

  return loads.filter((load) => !failed.has(loadKey(load)));
}
