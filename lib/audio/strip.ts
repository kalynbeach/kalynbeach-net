import { connectTap } from "./feed";
import type { SampleFeed, TapReceiver } from "./feed";
import { createFilePlayer, isAudioFile } from "./file";
import type { FileHandle, FilePlayback, FilePlayer } from "./file";
import { captureInput, stopTracks, toSourceError } from "./input";
import type {
  DeviceList,
  InputCapture,
  InputDevice,
  InputHandle,
} from "./input";
import {
  createNoiseBed,
  endNoiseBed,
  releaseNoiseBed,
  tuneNoiseBed,
} from "./noise";
import type { NoiseBed, NoiseSettings } from "./noise";
import { createToneGraph } from "./oscillators";
import type { ToneGraph } from "./oscillators";
import {
  createSourceFade,
  createStripChain,
  levelToGain,
  RAMP_SLACK_MS,
  rampGain,
  SOURCE_FADE,
} from "./safety";
import type { StripChain } from "./safety";
import type { ToneHandle, ToneProgram, ToneSource } from "./tones";
import { clampNumber, err, ok } from "./units";
import type { Result, Seconds } from "./units";
import { loadWorklets } from "./worklet";
import type { WorkletError } from "./worklet";
import { TAP_PROCESSOR } from "./worklet-source";

export type StripOptions = {
  /** For logs. */
  readonly label: string;
  /**
   * The strip gain at level 1. The output stays within ceiling × level²
   * when the source peak plus NOISE_PEAK × noiseLevel² stays at or below 1.
   * Callers budget the bed's headroom with the exported NOISE_PEAK.
   */
  readonly ceiling: number;
  /**
   * Whether the strip feeds a SampleFeed. The strip loads its tap worklet on
   * each context it attaches to and publishes the feed through getFeed().
   */
  readonly tap: boolean;
  /**
   * Whether the strip may capture input. The station creates its context with
   * latencyHint "playback" only when no open strip may capture.
   */
  readonly captures: boolean;
  /** Now Playing metadata, set through navigator.mediaSession while this strip plays a source. */
  readonly media?: { readonly title: string; readonly artist?: string };
};

export type SourceSpec =
  | ({
      readonly kind: "tones";
      /**
       * Applied before the oscillators start, so the first rendered frame
       * already follows it: the envelope begins at the program's first
       * envelope value instead of 1. Times are on the station's clock.
       */
      readonly program?: ToneProgram;
    } & ToneSource)
  | { readonly kind: "input"; readonly deviceId: string | null }
  | {
      readonly kind: "file";
      /** A local File, or a URL whose host sends Access-Control-Allow-Origin. */
      readonly file: File | URL;
      readonly loop: boolean;
    };

export type SourceKind = SourceSpec["kind"];

type SourceHandles = {
  tones: ToneHandle;
  input: InputHandle;
  file: FileHandle;
};

export type HandleFor<S extends SourceSpec> = SourceHandles[S["kind"]];

export type SourceError =
  | { readonly kind: "station-not-running" }
  | { readonly kind: "superseded" }
  | { readonly kind: "permission-denied" }
  | { readonly kind: "device-not-found" }
  | { readonly kind: "device-busy" }
  | { readonly kind: "insecure-context" }
  | { readonly kind: "unsupported-file"; readonly name: string }
  | { readonly kind: "unknown"; readonly message: string };

/**
 * What the strip is playing. The strip is the only writer; blocks read it
 * through subscribe() and never keep their own copy.
 */
export type SourceStatus =
  | { readonly kind: "none" }
  | { readonly kind: "connecting"; readonly source: SourceKind }
  | { readonly kind: "tones" }
  | {
      readonly kind: "input";
      readonly device: InputDevice;
      readonly channels: 1 | 2;
      /** The track ended under us: unplugged, revoked, or taken by the OS. */
      readonly ended: boolean;
    }
  | {
      readonly kind: "file";
      readonly name: string;
      readonly duration: Seconds | null;
      readonly playback: FilePlayback;
    }
  | {
      readonly kind: "failed";
      readonly source: SourceKind;
      readonly error: SourceError;
    };

export type FeedError =
  | { readonly kind: "no-tap" }
  | { readonly kind: "station-not-running" }
  | WorkletError;

export type NoiseError =
  | { readonly kind: "station-not-running" }
  | WorkletError;

export interface Strip {
  getStatus(): SourceStatus;
  /**
   * The tap's feed on the current context, or an error when the tap cannot
   * load there. Null while the strip has no context or its tap is loading,
   * which includes the time from a restart until the new context's tap
   * loads, and after close(). A strip opened without `tap` always returns the
   * same "no-tap" error. The value stays the same object until it changes, so
   * useSyncExternalStore can read it.
   */
  getFeed(): Result<SampleFeed, FeedError> | null;
  /** Calls `listener` after the status or the feed changes. */
  subscribe(listener: () => void): () => void;
  /**
   * Plays `spec`, replacing the current source. Needs a context: call
   * AudioStation.start() first, in the same gesture, which creates it
   * synchronously. Call play() from the gesture too when the source is a
   * file, so its element starts inside the activation. Failures also land in
   * getStatus() as { kind: "failed" }, so callers may ignore the result.
   */
  play<S extends SourceSpec>(
    spec: S
  ): Promise<Result<HandleFor<S>, SourceError>>;
  /** Fades the source out over 30 ms and disposes it. Status becomes "none". Idempotent. */
  stop(): void;
  /** 0 to 1. Gain is ceiling × level², ramped over 20 ms. */
  setLevel(level: number): void;
  /** Off mutes the strip's output without touching the tap. */
  setMonitor(on: boolean): void;
  /**
   * Stores the noise bed settings. They apply whenever the strip has a
   * context, including after restart(). The result says whether they apply
   * now. Level changes ramp over at least 20 ms; "off" fades out and releases
   * the processor, so the tap carries no noise.
   */
  setNoise(settings: NoiseSettings): Promise<Result<void, NoiseError>>;
  /**
   * The tap's load on the current context, for a caller that awaits it.
   * Resolves to the same feed while the context is the same, and to
   * "station-not-running" once the strip has closed or while it has no
   * context. To follow the feed across restarts, read getFeed() and
   * subscribe() instead.
   */
  feed(): Promise<Result<SampleFeed, FeedError>>;
  /** Stops the source, disconnects every node, and leaves the station. Idempotent. */
  close(): void;
}

// ---------------------------------------------------------------------------
// Internal: how the station and a strip talk. Not exported from index.ts.

/** What a strip needs from the station. */
export type StripHost = {
  readonly mediaDevices: MediaDevices | null;
  readonly inputs: DeviceList;
  readonly setTimer: (callback: () => void, ms: number) => () => void;
  /** The strip's status changed, which may change what the station plays. */
  changed(): void;
  /** The strip closed and leaves the station. */
  remove(strip: StripRuntime): void;
};

/** A strip as the station holds it. */
export type StripRuntime = Strip & {
  readonly options: StripOptions;
  /**
   * Builds the strip's nodes on `context` into `master`, then reattaches its
   * source and noise bed from their last settings. Synchronous, so restart()
   * reattaches inside its gesture. A tap strip also starts loading its tap,
   * which getFeed() publishes once it loads.
   */
  attach(context: AudioContext, master: AudioNode): void;
  /**
   * Drops every node on the current context, the published feed with them,
   * and keeps the settings for the next attach().
   */
  detach(): void;
  /** The kind of source playing or connecting, or null when the strip is silent. */
  playing(): SourceKind | null;
};

/** set()'s glide when the caller passes none. */
const DEFAULT_GLIDE = 0.03;

const NONE: SourceStatus = { kind: "none" };

const TONES: SourceStatus = { kind: "tones" };

const NO_TAP: Result<SampleFeed, FeedError> = err({ kind: "no-tap" });

type Attachment = {
  readonly context: AudioContext;
  readonly chain: StripChain;
};

type Tap = {
  readonly node: AudioWorkletNode;
  readonly silent: GainNode;
  readonly receiver: TapReceiver;
};

/** What every source holds on the current context besides its own nodes. */
type SourceNodes = {
  /** Rises from silence on attach and falls to it on retire; the bed plays through it too. */
  fade: GainNode | null;
  envelope: GainNode | null;
  /** The source's noise bed, while the strip's noise settings are on. */
  bed: NoiseBed | null;
};

/**
 * The current source and whatever it holds on the current context. Each
 * variant keeps what attach() needs to rebuild it on a new context: the last
 * tone source, the captured track, or the file player.
 */
type SourceState = SourceNodes &
  (
    | {
        readonly kind: "tones";
        source: ToneSource;
        /** The program play() started under, applied on the first attach only; restart() drops programs. */
        opening: ToneProgram | null;
        graph: ToneGraph | null;
        readonly handle: ToneHandle;
        readonly end: (reason: "programmed" | "replaced") => void;
      }
    | {
        readonly kind: "input";
        readonly capture: InputCapture;
        node: AudioNode | null;
        ended: boolean;
      }
    | {
        readonly kind: "file";
        readonly player: FilePlayer;
        ready: boolean;
      }
  );

type ToneState = Extract<SourceState, { readonly kind: "tones" }>;

type InputState = Extract<SourceState, { readonly kind: "input" }>;

type FileState = Extract<SourceState, { readonly kind: "file" }>;

/**
 * Opens a strip on `host`. It starts silent: level 0 with the monitor on, so
 * nothing sounds until a block sets a level.
 */
export function createStrip(
  options: StripOptions,
  host: StripHost
): StripRuntime {
  const listeners = new Set<() => void>();
  let status: SourceStatus = NONE;
  let current: SourceState | null = null;
  let attachment: Attachment | null = null;
  let level = 0;
  let monitor = true;
  let noise: NoiseSettings = { color: "off", level: 0 };
  // The context the worklet processors are known loaded on, so a source can
  // build its bed synchronously, in the same call that starts it.
  let workletsOn: AudioContext | null = null;
  let tap: Tap | null = null;
  // The load attach() started for the current attachment, which feed() returns.
  let tapLoad: Promise<Result<SampleFeed, FeedError>> | null = null;
  let published: Result<SampleFeed, FeedError> | null = null;
  // Every play(), stop(), and close() moves it, so an older play() that
  // resumes after an await knows it was superseded.
  let generation = 0;
  let closed = false;

  function setStatus(next: SourceStatus): void {
    if (JSON.stringify(next) === JSON.stringify(status)) return;

    status = next;

    for (const listener of listeners) listener();

    host.changed();
  }

  /**
   * Stores what getFeed() returns and notifies the listeners when it changes.
   * A feed is not status, so this skips setStatus() and the station's
   * reconcile that host.changed() runs.
   */
  function publishFeed(next: Result<SampleFeed, FeedError> | null): void {
    if (next === published) return;

    published = next;

    for (const listener of listeners) listener();
  }

  function fail(
    source: SourceKind,
    error: SourceError
  ): Result<never, SourceError> {
    setStatus({ kind: "failed", source, error });

    return err(error);
  }

  function outputGain(): number {
    return monitor ? levelToGain(level, options.ceiling) : 0;
  }

  function attachSource(source: SourceState, to: Attachment): void {
    const envelope = to.context.createGain();

    envelope.connect(to.chain.mix);

    const fade = createSourceFade(to.context, envelope);

    source.envelope = envelope;

    source.fade = fade;

    switch (source.kind) {
      case "tones": {
        source.graph = createToneGraph(to.context, {
          source: source.source,
          envelope: envelope.gain,
          fade: fade.gain,
          when: to.context.currentTime,
          program: source.opening,
          onEnded: () => toneEnded(source),
          setTimer: host.setTimer,
        });

        source.opening = null;
        source.graph.output.connect(fade);
        break;
      }

      case "input": {
        // A stream of exactly this track: MediaStreamAudioSourceNode plays
        // the first audio track by id, whatever else the stream holds.
        source.node = to.context.createMediaStreamSource(
          new MediaStream([source.capture.track])
        );

        source.node.connect(fade);
        break;
      }

      case "file":
        source.player.attach(to.context, fade);
    }

    if (noise.color === "off") return;

    if (workletsOn === to.context) applyBed(source, to);
    else void applyNoise();
  }

  function detachSource(source: SourceState): void {
    switch (source.kind) {
      case "tones":
        source.graph?.dispose();
        source.graph = null;
        break;

      case "input":
        source.node?.disconnect();
        source.node = null;
        break;

      case "file":
        source.player.detach();
    }

    if (source.bed) endNoiseBed(source.bed);

    source.bed = null;
    source.fade?.disconnect();
    source.fade = null;
    source.envelope?.disconnect();
    source.envelope = null;
  }

  function releaseSource(source: SourceState): void {
    detachSource(source);

    if (source.kind === "input") stopTracks(source.capture.stream);

    if (source.kind === "file") source.player.dispose();
  }

  /** Fades `source` out over SOURCE_FADE, then releases it. The caller has already moved `current` on. */
  function retire(source: SourceState): void {
    if (source.kind === "tones") source.end("replaced");

    const fade = source.fade;

    if (!attachment || !fade) {
      releaseSource(source);

      return;
    }

    rampGain(fade.gain, 0, attachment.context.currentTime, SOURCE_FADE);
    host.setTimer(
      () => releaseSource(source),
      SOURCE_FADE * 1000 + RAMP_SLACK_MS
    );
  }

  /** Runs `attachSource` for a source that is or is about to be current, failing the strip if the context refuses it. */
  function tryAttach(source: SourceState, to: Attachment): boolean {
    try {
      attachSource(source, to);

      return true;
    } catch (cause) {
      if (current === source) current = null;

      releaseSource(source);
      fail(source.kind, toSourceError(cause));

      return false;
    }
  }

  function toneEnded(source: ToneState): void {
    if (current !== source) return;

    current = null;
    source.end("programmed");
    releaseSource(source);
    setStatus(NONE);
  }

  function createToneState(
    source: ToneSource,
    opening: ToneProgram | null
  ): ToneState {
    let end: (reason: "programmed" | "replaced") => void = () => {};

    const ended = new Promise<"programmed" | "replaced">((resolve) => {
      end = resolve;
    });

    const state: ToneState = {
      kind: "tones",
      source,
      opening,
      graph: null,
      fade: null,
      envelope: null,
      bed: null,
      end: (reason) => end(reason),
      handle: {
        ended,
        set(pair, glide) {
          if (current !== state) return;

          state.source = { ...state.source, tones: pair };
          state.graph?.set(pair, glide ?? DEFAULT_GLIDE);
        },
        program(program) {
          if (current === state) state.graph?.program(program);
        },
      },
    };

    return state;
  }

  function inputStatus(source: InputState): SourceStatus {
    return {
      kind: "input",
      device: source.capture.handle.device,
      channels: source.capture.handle.channels,
      ended: source.ended,
    };
  }

  function fileStatus(source: FileState): SourceStatus {
    return {
      kind: "file",
      name: source.player.handle.name,
      duration: source.player.handle.duration(),
      playback: source.player.playback(),
    };
  }

  function fileChanged(source: FileState): void {
    if (current !== source) return;

    const error = source.player.error();

    if (error) {
      current = null;
      releaseSource(source);
      fail("file", error);

      return;
    }

    if (source.ready) setStatus(fileStatus(source));
  }

  function playTones(
    spec: ToneSource,
    opening: ToneProgram | null,
    to: Attachment
  ): Result<ToneHandle, SourceError> {
    const source = createToneState(
      { tones: spec.tones, routing: spec.routing, pulse: spec.pulse },
      opening
    );

    current = source;

    if (!tryAttach(source, to)) return err(failure());

    setStatus(TONES);

    return ok(source.handle);
  }

  async function playInput(
    deviceId: string | null,
    playing: number
  ): Promise<Result<InputHandle, SourceError>> {
    setStatus({ kind: "connecting", source: "input" });

    const captured = await captureInput(
      host.mediaDevices,
      deviceId,
      host.inputs.getSnapshot()
    );

    if (playing !== generation) {
      if (captured.ok) stopTracks(captured.value.stream);

      return err({ kind: "superseded" });
    }

    if (!captured.ok) return fail("input", captured.error);

    void host.inputs.refresh();

    const to = attachment;

    const source: InputState = {
      kind: "input",
      capture: captured.value,
      node: null,
      fade: null,
      envelope: null,
      bed: null,
      ended: false,
    };

    if (!to) {
      releaseSource(source);

      return fail("input", { kind: "station-not-running" });
    }

    current = source;

    if (!tryAttach(source, to)) return err(failure());

    source.capture.track.addEventListener("ended", () => {
      if (current !== source) return;

      source.ended = true;

      if (source.bed && attachment)
        releaseNoiseBed(
          source.bed,
          attachment.context.currentTime,
          host.setTimer
        );

      source.bed = null;
      setStatus(inputStatus(source));
    });

    setStatus(inputStatus(source));

    return ok(source.capture.handle);
  }

  async function playFile(
    file: File | URL,
    loop: boolean,
    to: Attachment,
    playing: number
  ): Promise<Result<FileHandle, SourceError>> {
    if (!(file instanceof URL) && !isAudioFile(file))
      return fail("file", { kind: "unsupported-file", name: file.name });

    const source: FileState = {
      kind: "file",
      player: createFilePlayer(file, loop, () => fileChanged(source)),
      fade: null,
      envelope: null,
      bed: null,
      ready: false,
    };

    current = source;
    setStatus({ kind: "connecting", source: "file" });

    // The element starts here, before the first await, inside the caller's gesture.
    if (!tryAttach(source, to)) return err(failure());

    const ready = await source.player.ready;

    if (playing !== generation) return err({ kind: "superseded" });

    if (!ready.ok) return err(ready.error);

    source.ready = true;
    setStatus(fileStatus(source));

    return ok(source.player.handle);
  }

  /** The error the status holds after a failed tryAttach. */
  function failure(): SourceError {
    return status.kind === "failed"
      ? status.error
      : { kind: "unknown", message: "The source could not start." };
  }

  async function playSpec(
    spec: SourceSpec
  ): Promise<Result<ToneHandle | InputHandle | FileHandle, SourceError>> {
    generation += 1;

    const playing = generation;
    const to = attachment;

    if (closed) return err({ kind: "station-not-running" });

    if (!to) return fail(spec.kind, { kind: "station-not-running" });

    if (current) {
      retire(current);
      current = null;
    }

    const opening = spec.kind === "tones" ? (spec.program ?? null) : null;

    switch (spec.kind) {
      case "tones":
        return playTones(spec, opening, to);

      case "input":
        return playInput(spec.deviceId, playing);

      case "file":
        return playFile(spec.file, spec.loop, to, playing);
    }
  }

  /**
   * Loads the noise processor on the current context when the settings need
   * it, then brings the current source's bed in line with the settings. With
   * no source there is nothing to sound, but the load still happens, so the
   * next source builds its bed in the same call that starts it.
   */
  async function applyNoise(): Promise<Result<void, NoiseError>> {
    const to = attachment;

    if (closed || !to) return err({ kind: "station-not-running" });

    if (noise.color !== "off" && workletsOn !== to.context) {
      const loaded = await loadWorklets(to.context);

      if (!loaded.ok) return loaded;

      // restart() swapped the context while the processor loaded.
      if (attachment !== to) return applyNoise();

      workletsOn = to.context;
    }

    return current ? applyBed(current, to) : ok(undefined);
  }

  /** Creates, tunes, or releases `source`'s bed to match the settings. The processor is loaded when the settings are on. */
  function applyBed(
    source: SourceState,
    to: Attachment
  ): Result<void, NoiseError> {
    const now = to.context.currentTime;

    if (!source.fade || (source.kind === "input" && source.ended))
      return ok(undefined);

    if (noise.color === "off") {
      if (source.bed) releaseNoiseBed(source.bed, now, host.setTimer);

      source.bed = null;

      return ok(undefined);
    }

    try {
      source.bed ??= createNoiseBed(to.context, source.fade, noise.color);
    } catch (cause) {
      return err({ kind: "worklet-blocked", message: messageOf(cause) });
    }

    tuneNoiseBed(source.bed, noise.color, noise.level, now);

    return ok(undefined);
  }

  async function openTap(
    to: Attachment
  ): Promise<Result<SampleFeed, FeedError>> {
    const loaded = await loadWorklets(to.context);

    if (!loaded.ok) return loaded;

    // A restart replaced `to`, or the strip closed and only waits out its fade.
    if (attachment !== to || closed)
      return err({ kind: "station-not-running" });

    let node: AudioWorkletNode;

    try {
      node = new AudioWorkletNode(to.context, TAP_PROCESSOR, {
        numberOfInputs: 1,
        numberOfOutputs: 1,
      });
    } catch (cause) {
      return err({ kind: "worklet-blocked", message: messageOf(cause) });
    }

    const silent = to.context.createGain();

    silent.gain.value = 0;
    to.chain.mix.connect(node);
    node.connect(silent);
    silent.connect(to.context.destination);

    const receiver = connectTap({
      port: node.port,
      context: to.context,
      setTimer: host.setTimer,
    });

    tap = { node, silent, receiver };

    return ok(receiver.feed);
  }

  function loadTap(to: Attachment): void {
    const load = openTap(to);

    tapLoad = load;
    void load.then((result) => {
      if (attachment === to && !closed) publishFeed(result);
    });
  }

  function closeTap(): void {
    if (tap) {
      tap.receiver.dispose();
      tap.node.disconnect();
      tap.silent.disconnect();
    }

    tap = null;
    tapLoad = null;
  }

  function detach(): void {
    const from = attachment;

    if (!from) return;

    if (current) detachSource(current);

    closeTap();
    from.chain.mix.disconnect();
    from.chain.level.disconnect();
    attachment = null;
    publishFeed(null);
  }

  const strip: StripRuntime = {
    options,
    getStatus: () => status,
    getFeed: () => (options.tap ? published : NO_TAP),
    subscribe(listener) {
      listeners.add(listener);

      return () => {
        listeners.delete(listener);
      };
    },
    play<S extends SourceSpec>(spec: S) {
      // SAFETY: playSpec answers each spec.kind with that kind's handle, which is HandleFor<S>.
      return playSpec(spec) as Promise<Result<HandleFor<S>, SourceError>>;
    },
    stop() {
      generation += 1;

      if (current) {
        retire(current);
        current = null;
      }

      setStatus(NONE);
    },
    setLevel(next) {
      level = clampNumber(next, { min: 0, max: 1 }, 0);

      if (attachment)
        rampGain(
          attachment.chain.level.gain,
          outputGain(),
          attachment.context.currentTime
        );
    },
    setMonitor(on) {
      monitor = on;

      if (attachment)
        rampGain(
          attachment.chain.level.gain,
          outputGain(),
          attachment.context.currentTime
        );
    },
    setNoise(settings) {
      noise = {
        color: settings.color,
        level: clampNumber(settings.level, { min: 0, max: 1 }, 0),
      };

      return applyNoise();
    },
    async feed() {
      if (!options.tap) return NO_TAP;

      if (closed || !tapLoad) return err({ kind: "station-not-running" });

      return tapLoad;
    },
    close() {
      if (closed) return;

      closed = true;
      generation += 1;

      const source = current;
      const from = attachment;

      current = null;

      if (source?.kind === "tones") source.end("replaced");

      const finish = () => {
        if (source) releaseSource(source);

        detach();
      };

      if (from) {
        rampGain(
          from.chain.level.gain,
          0,
          from.context.currentTime,
          SOURCE_FADE
        );
        host.setTimer(finish, SOURCE_FADE * 1000 + RAMP_SLACK_MS);
      } else finish();

      host.remove(strip);
      publishFeed(null);
      setStatus(NONE);
    },
    attach(context, master) {
      if (closed) return;

      const to: Attachment = {
        context,
        chain: createStripChain(context, master, outputGain()),
      };

      attachment = to;

      if (current) tryAttach(current, to);

      if (options.tap) loadTap(to);
    },
    detach,
    playing() {
      switch (status.kind) {
        case "connecting":
          return status.source;

        case "tones":
          return "tones";

        case "input":
          return status.ended ? null : "input";

        case "file":
          return status.playback === "playing" ? "file" : null;

        default:
          return null;
      }
    },
  };

  return strip;
}

function messageOf(cause: unknown): string {
  return cause instanceof Error ? cause.message : String(cause);
}
