import type { SourceError } from "./strip";
import { err, ok, toSeconds } from "./units";
import type { Result, Seconds } from "./units";

/** "blocked": the browser refused to start playback without a user gesture. */
export type FilePlayback = "playing" | "paused" | "ended" | "blocked";

/**
 * Returned by Strip.play({ kind: "file" }). Valid until the strip plays
 * another source or stops; AudioStation.restart() rebinds it to a new element
 * at the same position.
 */
export interface FileHandle {
  readonly name: string;
  /** Null until the element knows it, or for a stream without one. */
  duration(): Seconds | null;
  /** Read on demand by a transport readout; not part of the strip status, which would change every frame. */
  position(): Seconds;
  /** Call from a gesture. Resolves when playback starts or the browser refuses; either lands in the strip status. */
  play(): Promise<void>;
  pause(): void;
  seek(position: Seconds): void;
  setLoop(loop: boolean): void;
}

// ---------------------------------------------------------------------------
// Internal: the player behind a FileHandle, built by the strip. Not exported
// from index.ts.

/** Extensions accepted when a file arrives without an audio/* type, as some drags and pickers deliver. */
const AUDIO_EXTENSIONS = new Set([
  "aac",
  "aif",
  "aiff",
  "caf",
  "flac",
  "m4a",
  "mp3",
  "oga",
  "ogg",
  "opus",
  "wav",
  "wave",
  "weba",
]);

export function isAudioFile(file: File): boolean {
  if (file.type.startsWith("audio/")) return true;

  const dot = file.name.lastIndexOf(".");

  return (
    dot >= 0 && AUDIO_EXTENSIONS.has(file.name.slice(dot + 1).toLowerCase())
  );
}

/** The element members a player touches. The strip passes new Audio(); tests pass a fake. */
export type PlayerElement = Pick<
  HTMLMediaElement,
  | "src"
  | "crossOrigin"
  | "loop"
  | "currentTime"
  | "duration"
  | "paused"
  | "error"
  | "play"
  | "pause"
  | "load"
  | "removeAttribute"
> &
  Pick<EventTarget, "addEventListener" | "removeEventListener">;

/** The context member a player touches. */
export type PlayerContext = {
  createMediaElementSource(element: PlayerElement): AudioNode;
};

export type FilePlayer = {
  readonly handle: FileHandle;
  playback(): FilePlayback;
  /** Set once an element fails to load or decode the file. */
  error(): SourceError | null;
  /** Settles when the first element has loaded metadata, or fails, or the player is disposed. */
  readonly ready: Promise<Result<void, SourceError>>;
  /**
   * Builds an element at the last position, routes it into `into`, and calls
   * element.play() when it should play, all before returning, so an attach
   * inside a gesture starts playback inside it. A media element joins only
   * one MediaElementAudioSourceNode, so every context gets a new element.
   */
  attach(context: PlayerContext, into: AudioNode): void;
  /** Remembers the position and whether it played, then releases the element. */
  detach(): void;
  /** detach(), then revokes a File's object URL. The handle stops working. */
  dispose(): void;
};

/** `onChange` fires whenever playback, duration, or the error changes. */
export function createFilePlayer(
  source: File | URL,
  loop: boolean,
  onChange: () => void,
  createElement: () => PlayerElement = () => new Audio()
): FilePlayer {
  const remote = source instanceof URL;
  const url = remote ? source.href : URL.createObjectURL(source);
  const name = remote ? nameOf(source) : source.name;
  let element: PlayerElement | null = null;
  let node: AudioNode | null = null;
  let position = 0;
  let wantsPlay = true;
  let playback: FilePlayback = "paused";
  let failure: SourceError | null = null;
  let disposed = false;
  let settleReady: (result: Result<void, SourceError>) => void = () => {};

  const ready = new Promise<Result<void, SourceError>>((resolve) => {
    settleReady = resolve;
  });

  function setPlayback(next: FilePlayback): void {
    if (next === playback) return;

    playback = next;
    onChange();
  }

  const listeners: readonly (readonly [string, () => void])[] = [
    ["playing", () => setPlayback("playing")],
    ["pause", () => setPlayback("paused")],
    ["ended", () => setPlayback("ended")],
    ["durationchange", onChange],
    [
      "loadedmetadata",
      () => {
        settleReady(ok(undefined));
        onChange();
      },
    ],
    [
      "error",
      () => {
        if (!element) return;

        failure = toFileError(element, name);
        settleReady(err(failure));
        onChange();
      },
    ],
  ];

  async function start(): Promise<void> {
    const current = element;

    if (!current) return;

    wantsPlay = true;

    try {
      await current.play();
    } catch (cause) {
      // AbortError (a pause or reload interrupted play) and NotSupportedError
      // (the error event reports it) need nothing here.
      if (current === element && isNotAllowed(cause)) setPlayback("blocked");
    }
  }

  function detach(): void {
    if (!element) return;

    position = Number.isFinite(element.currentTime) ? element.currentTime : 0;
    wantsPlay = !element.paused;

    for (const [type, listener] of listeners)
      element.removeEventListener(type, listener);

    element.pause();
    element.removeAttribute("src");
    element.load();
    node?.disconnect();
    element = null;
    node = null;
  }

  return {
    handle: {
      name,
      duration() {
        const duration = element?.duration ?? Number.NaN;

        return Number.isFinite(duration) && duration >= 0
          ? toSeconds(duration)
          : null;
      },
      position() {
        const current = element ? element.currentTime : position;

        return toSeconds(Number.isFinite(current) ? Math.max(current, 0) : 0);
      },
      play: () => start(),
      pause() {
        wantsPlay = false;
        element?.pause();
      },
      seek(next) {
        position = next;

        if (element) element.currentTime = next;
      },
      setLoop(next) {
        loop = next;

        if (element) element.loop = next;
      },
    },
    playback: () => playback,
    error: () => failure,
    ready,
    attach(context, into) {
      if (disposed) return;

      detach();

      const next = createElement();

      next.loop = loop;

      if (remote) next.crossOrigin = "anonymous";

      next.src = url;

      if (position > 0) next.currentTime = position;

      for (const [type, listener] of listeners)
        next.addEventListener(type, listener);

      const source = context.createMediaElementSource(next);

      source.connect(into);
      element = next;
      node = source;

      if (wantsPlay) void start();
    },
    detach,
    dispose() {
      if (disposed) return;

      disposed = true;
      detach();

      if (!remote) URL.revokeObjectURL(url);

      settleReady(err({ kind: "superseded" }));
    },
  };
}

/** The decoded last path segment, or the host when the path has none. A malformed escape keeps the raw segment. */
function nameOf(url: URL): string {
  const segment = url.pathname.split("/").filter(Boolean).at(-1);

  if (!segment) return url.host;

  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
}

function isNotAllowed(cause: unknown): boolean {
  return (
    (cause instanceof DOMException || cause instanceof Error) &&
    cause.name === "NotAllowedError"
  );
}

function toFileError(element: PlayerElement, name: string): SourceError {
  const error = element.error;

  if (error && error.code === error.MEDIA_ERR_SRC_NOT_SUPPORTED)
    return { kind: "unsupported-file", name };

  return {
    kind: "unknown",
    message: error?.message || "The file could not be played.",
  };
}
