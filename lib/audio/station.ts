import { createDeviceList } from "./input";
import type { DeviceList } from "./input";
import { createSafetyStage } from "./safety";
import { createStrip } from "./strip";
import type {
  SourceKind,
  Strip,
  StripHost,
  StripOptions,
  StripRuntime,
} from "./strip";
import { toContextTime } from "./units";
import type { ContextTime } from "./units";

export type StationSnapshot =
  | { readonly state: "unsupported" }
  /** No context yet. The next user gesture should call start(). */
  | { readonly state: "idle" }
  | { readonly state: "starting" }
  | {
      readonly state: "running";
      readonly sampleRate: number;
      /** Contexts this station has created, starting at 1. Changes invalidate feeds and programs. */
      readonly context: number;
    }
  /**
   * "station": suspended by the idle rule; resumes when a strip plays or on start().
   * "system": the browser or OS holds audio (an interruption, an autoplay
   * block, or a resume() that did not settle in time); call start() from a
   * gesture to retry, or restart() when that does not help.
   */
  | { readonly state: "suspended"; readonly by: "station" | "system" }
  | { readonly state: "failed"; readonly error: StationError };

export type StationError =
  | { readonly kind: "context-failed"; readonly message: string }
  | { readonly kind: "closed" };

export interface AudioStation {
  /** Stable identity between changes, for useSyncExternalStore. */
  getSnapshot(): StationSnapshot;
  subscribe(listener: () => void): () => void;
  /**
   * Creates or resumes the context. Call it synchronously from a click or key
   * handler. Settles within RESUME_TIMEOUT_MS. Idempotent: while running it
   * resolves at once, and a second call while starting returns the first
   * call's promise.
   */
  start(): Promise<StationSnapshot>;
  /**
   * Closes the context and builds a new one, from a gesture. Every strip
   * reattaches synchronously in the same call: tones, noise, and a file's
   * element restart at their last settings and position, and an input keeps
   * its stream. Handles stay valid. Each tap strip drops its feed and
   * publishes the new context's feed through getFeed() itself. Tone programs
   * do not carry over, so blocks re-send them when the running snapshot's
   * context number changes.
   */
  restart(): Promise<StationSnapshot>;
  /** The context clock, or null before the first start(). */
  currentTime(): ContextTime | null;
  /** Opens a strip. Works in every state; its nodes attach once the context exists. */
  openStrip(options: StripOptions): Strip;
  readonly inputs: DeviceList;
}

/** How long start() waits on resume() before reporting suspended by "system". */
export const RESUME_TIMEOUT_MS = 1500;

/** How long the station waits with no playing strip before it suspends the context. */
export const IDLE_SUSPEND_MS = 2000;

/** Safari's navigator.audioSession. Not in TypeScript 7's lib.dom, so it is declared here and read with a guard. */
export type AudioSessionLike = {
  type:
    | "auto"
    | "playback"
    | "transient"
    | "transient-solo"
    | "ambient"
    | "play-and-record";
};

/** The browser globals the station touches. getAudioStation() passes the real ones; tests pass fakes. */
export type StationEnv = {
  readonly createContext:
    | ((options: AudioContextOptions) => AudioContext)
    | null;
  readonly mediaDevices: MediaDevices | null;
  readonly audioSession: AudioSessionLike | null;
  readonly mediaSession: MediaSession | null;
  readonly setTimer: (callback: () => void, ms: number) => () => void;
};

let page: AudioStation | null = null;

/** The server has no audio. Nothing schedules a timer there, since no context ever exists. */
const SERVER_ENV: StationEnv = {
  createContext: null,
  mediaDevices: null,
  audioSession: null,
  mediaSession: null,
  setTimer: () => () => {},
};

/** The page's station, created on first call. Safe to call during SSR, where it reports "unsupported" and touches no globals. */
export function getAudioStation(): AudioStation {
  // A fresh one per server call, so strips opened during one render can't
  // leak into the next request.
  if (typeof window === "undefined") return createAudioStation(SERVER_ENV);

  page ??= createAudioStation(browserEnv());

  return page;
}

/** Synchronous capability check for first render: Web Audio and AudioWorklet in a secure window. */
export function detectAudioSupport(): "supported" | "unsupported" {
  if (typeof window === "undefined" || !window.isSecureContext)
    return "unsupported";

  if (
    typeof AudioContext === "undefined" ||
    typeof AudioWorkletNode === "undefined"
  )
    return "unsupported";

  return "supported";
}

function browserEnv(): StationEnv {
  const supported = detectAudioSupport() === "supported";

  return {
    createContext: supported ? (options) => new AudioContext(options) : null,
    // Browsers leave mediaDevices off navigator outside a secure context.
    mediaDevices: "mediaDevices" in navigator ? navigator.mediaDevices : null,
    audioSession: hasAudioSession(navigator) ? navigator.audioSession : null,
    mediaSession: hasMediaSession(navigator) ? navigator.mediaSession : null,
    setTimer(callback, ms) {
      const id = window.setTimeout(callback, ms);

      return () => window.clearTimeout(id);
    },
  };
}

function hasAudioSession(
  value: Navigator
): value is Navigator & { readonly audioSession: AudioSessionLike } {
  return "audioSession" in value;
}

function hasMediaSession(
  value: Navigator
): value is Navigator & { readonly mediaSession: MediaSession } {
  return "mediaSession" in value;
}

const UNSUPPORTED: StationSnapshot = { state: "unsupported" };

const IDLE: StationSnapshot = { state: "idle" };

const STARTING: StationSnapshot = { state: "starting" };

const SUSPENDED_BY_STATION: StationSnapshot = {
  state: "suspended",
  by: "station",
};

const SUSPENDED_BY_SYSTEM: StationSnapshot = {
  state: "suspended",
  by: "system",
};

const ignore = () => {};

/**
 * The station factory. getAudioStation() calls it once with the browser's globals; tests call it with fakes.
 *
 * It keeps three things apart: the snapshot the UI reads, derived from facts;
 * `wanted`, whether the station wants the context running; and `generation`,
 * which every start, idle suspend, and restart moves, so a resume can tell
 * whether start() still waits on it. reconcile() runs on every statechange,
 * resume settlement, timeout, and strip change, compares the context's state
 * with `wanted`, and applies only the difference.
 */
export function createAudioStation(env: StationEnv): AudioStation {
  const listeners = new Set<() => void>();
  const strips = new Set<StripRuntime>();
  const inputs = createDeviceList(env.mediaDevices);
  let snapshot: StationSnapshot = env.createContext ? IDLE : UNSUPPORTED;
  let context: AudioContext | null = null;
  let contextsCreated = 0;
  let master: AudioNode | null = null;
  let failure: StationError | null = null;
  let wanted: "running" | "suspended" = "running";
  let generation = 0;
  // The generation whose resume start() still waits on, until it settles or times out.
  let pending: number | null = null;
  let starting: Promise<StationSnapshot> | null = null;
  let cancelIdle: (() => void) | null = null;
  let sessionBefore: AudioSessionLike["type"] | null = null;
  let metadataOwner: StripRuntime | null = null;
  let metadata: MediaMetadata | null = null;

  function derive(): StationSnapshot {
    if (!env.createContext) return UNSUPPORTED;

    if (failure) return { state: "failed", error: failure };

    if (!context) return IDLE;

    switch (context.state) {
      case "running":
        return {
          state: "running",
          sampleRate: context.sampleRate,
          context: contextsCreated,
        };

      case "closed":
        return { state: "failed", error: { kind: "closed" } };

      case "suspended":
      case "interrupted":
        if (pending !== null) return STARTING;

        return context.state === "suspended" && wanted === "suspended"
          ? SUSPENDED_BY_STATION
          : SUSPENDED_BY_SYSTEM;
    }
  }

  function publish(): void {
    const next = derive();

    if (JSON.stringify(next) === JSON.stringify(snapshot)) return;

    snapshot = next;

    for (const listener of listeners) listener();
  }

  function playingKinds(): Set<SourceKind> {
    const kinds = new Set<SourceKind>();

    for (const strip of strips) {
      const kind = strip.playing();

      if (kind) kinds.add(kind);
    }

    return kinds;
  }

  function reconcile(): void {
    if (context && wanted === "suspended" && context.state === "running")
      void context.suspend().catch(ignore);

    scheduleIdle();
    applySession();
    applyMetadata();
    publish();
  }

  function scheduleIdle(): void {
    const due =
      context !== null &&
      context.state !== "closed" &&
      wanted === "running" &&
      playingKinds().size === 0;

    if (!due) {
      cancelIdle?.();
      cancelIdle = null;

      return;
    }

    cancelIdle ??= env.setTimer(() => {
      cancelIdle = null;
      idle();
    }, IDLE_SUSPEND_MS);
  }

  function idle(): void {
    if (!context || wanted !== "running" || playingKinds().size > 0) return;

    wanted = "suspended";
    generation += 1;
    pending = null;
    starting = null;

    // reconcile() suspends a running context. A suspended one may still have
    // a resume pending, which this suspend() cancels so it can't start late.
    if (context.state === "suspended" || context.state === "interrupted")
      void context.suspend().catch(ignore);

    reconcile();
  }

  function applySession(): void {
    const session = env.audioSession;

    if (!session) return;

    const kinds = playingKinds();
    let target = sessionBefore;

    if (kinds.has("input")) target = "play-and-record";
    else if (kinds.size > 0) target = "playback";

    if (target === null || session.type === target) return;

    sessionBefore ??= session.type;
    session.type = target;
  }

  function applyMetadata(): void {
    const session = env.mediaSession;

    if (!session || typeof MediaMetadata === "undefined") return;

    let owner: StripRuntime | null = null;

    for (const strip of strips) {
      if (!strip.options.media || strip.playing() === null) continue;

      owner = strip;
      break;
    }

    if (owner === metadataOwner) return;

    metadataOwner = owner;

    if (owner?.options.media) {
      metadata = new MediaMetadata({ ...owner.options.media });
      session.metadata = metadata;

      return;
    }

    if (metadata && session.metadata === metadata) session.metadata = null;

    metadata = null;
  }

  /** Replaces the context with a new one and reattaches every strip, all synchronously. */
  function build(
    createContext: (options: AudioContextOptions) => AudioContext
  ): AudioContext | null {
    const old = context;

    for (const strip of strips) strip.detach();

    context = null;
    master = null;

    // Not awaited; the old context's "closed" statechange no longer reaches
    // reconcile(), which listens only to the current context.
    if (old && old.state !== "closed") void old.close().catch(ignore);

    let next: AudioContext;

    try {
      next = createContext(anyCaptures() ? {} : { latencyHint: "playback" });
      contextsCreated += 1;
    } catch (cause) {
      failure = {
        kind: "context-failed",
        message: cause instanceof Error ? cause.message : String(cause),
      };

      publish();

      return null;
    }

    failure = null;
    context = next;
    master = createSafetyStage(next);
    next.addEventListener("statechange", () => {
      if (context === next) reconcile();
    });

    for (const strip of strips) strip.attach(next, master);

    applySession();

    return next;
  }

  function anyCaptures(): boolean {
    for (const strip of strips) if (strip.options.captures) return true;

    return false;
  }

  /**
   * Resumes `target` and settles within RESUME_TIMEOUT_MS. resume() is called
   * before anything awaits, so a call from a gesture handler stays inside the
   * gesture. A settlement after the timeout only reconciles, so a resume the
   * station no longer wants is suspended again rather than played.
   */
  function resume(target: AudioContext): Promise<StationSnapshot> {
    const mine = generation;
    let settled = false;
    let cancelTimer: () => void = ignore;
    let resolve: (value: StationSnapshot) => void = ignore;

    const promise = new Promise<StationSnapshot>((done) => {
      resolve = done;
    });

    const settle = () => {
      if (settled) {
        reconcile();

        return;
      }

      settled = true;
      cancelTimer();

      if (pending === mine) pending = null;

      if (starting === promise) starting = null;

      reconcile();
      resolve(snapshot);
    };

    pending = mine;
    starting = promise;
    cancelTimer = env.setTimer(settle, RESUME_TIMEOUT_MS);
    target.resume().then(settle, settle);
    reconcile();

    return promise;
  }

  function stripsChanged(): void {
    // A strip that starts playing while the idle rule holds the context resumes it.
    if (context && wanted === "suspended" && playingKinds().size > 0) {
      wanted = "running";
      generation += 1;
      void resume(context);

      return;
    }

    reconcile();
  }

  const host: StripHost = {
    mediaDevices: env.mediaDevices,
    inputs,
    setTimer: env.setTimer,
    changed: stripsChanged,
    remove(strip) {
      strips.delete(strip);
      stripsChanged();
    },
  };

  return {
    getSnapshot: () => snapshot,
    subscribe(listener) {
      listeners.add(listener);

      return () => {
        listeners.delete(listener);
      };
    },
    start() {
      const createContext = env.createContext;

      if (!createContext) return Promise.resolve(snapshot);

      if (starting) return starting;

      const wasWanted = wanted;

      wanted = "running";
      generation += 1;

      if (context?.state === "running" && wasWanted === "running") {
        reconcile();

        return Promise.resolve(snapshot);
      }

      const target =
        context && context.state !== "closed" ? context : build(createContext);

      if (!target) return Promise.resolve(snapshot);

      applySession();

      return resume(target);
    },
    restart() {
      const createContext = env.createContext;

      if (!createContext) return Promise.resolve(snapshot);

      wanted = "running";
      generation += 1;

      const target = build(createContext);

      if (!target) return Promise.resolve(snapshot);

      return resume(target);
    },
    currentTime: () => (context ? toContextTime(context.currentTime) : null),
    openStrip(options) {
      const strip = createStrip(options, host);

      strips.add(strip);

      if (context && master) strip.attach(context, master);

      return strip;
    },
    inputs,
  };
}
