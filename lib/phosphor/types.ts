export type Rgb = readonly [number, number, number];

export type Backend = "webgpu" | "webgl2";

export type PhosphorSupport = "unknown" | Backend | "unsupported";

export type ScreenPresetId = "p31" | "p7" | "p11" | "neutral";

/** Kevelle's signal colors. The screen resolves each from its CSS custom property on the canvas element. */
export type SignalColor =
  | "phosphor"
  | "astral"
  | "flame"
  | "magenta"
  | "chrome";

/** "screen" is the preset's own emission. P31's is the predecessor's trace color. */
export type TraceColor = "screen" | SignalColor;

/**
 * "line": the predecessor's 1px line strip, a constant deposit per covered
 * pixel. "gaussian": a beam with a gaussian cross-section whose deposit per
 * unit length falls as the beam moves faster, so slow parts of a figure glow
 * and fast edges fade, as on a CRT.
 */
export type BeamStyle = "line" | "gaussian";

export type TraceIndex = 0 | 1 | 2 | 3;

/**
 * What the canvas sits on.
 *
 * "screen": the phosphor's own opaque screen, lifted by `background`. The
 * predecessor's composite, byte for byte.
 * "dark": transparent over a dark page. The composite emits premultiplied
 * light whose alpha is its brightest channel.
 * "light": transparent over a light page. The light keeps its own hue, and
 * its alpha rises with energy to a ceiling, so it never reads as ink.
 */
export type Ground = "screen" | "dark" | "light";

export type PhosphorLook = {
  readonly screen: ScreenPresetId;
  readonly beam: BeamStyle;
  /** 16 to 128. The predecessor's trailLength, same mapping, so the default look ports exactly. */
  readonly persistence: number;
  /** 0 to 1.5. The predecessor's bloom. */
  readonly bloom: number;
  /** 0 to 0.1. The predecessor's canvas.background, the clear value and floor lift. */
  readonly background: number;
  /** Gaussian beam sigma in CSS pixels, 0.5 to 4. Ignored by "line". */
  readonly focus: number;
  /** Beam energy, both beams, 0.25 to 4. 1 is the original Oscilloscope at 60 Hz. */
  readonly intensity: number;
  /**
   * Colors by trace index. Trace 0 is required; a producer may use up to
   * four. A trace index past the list draws in the screen's own color.
   */
  readonly traces: readonly [TraceColor, ...TraceColor[]];
  /** Allow HDR output where the canvas supports extended tone mapping. The screen and dark grounds only. */
  readonly hdr: boolean;
  /** What the canvas sits on. A change re-resolves the trace colors. */
  readonly ground: Ground;
  /**
   * Backing pixels per device pixel, 0.25 to 1. The canvas keeps its CSS
   * size, and the browser scales the backing store up.
   */
  readonly resolution: number;
};

/** What the screen tells a producer each frame. */
export type FrameInfo = {
  /** The requestAnimationFrame timestamp in milliseconds. Feeds map it to an audio frame. */
  readonly now: DOMHighResTimeStamp;
  /** Seconds since the previous frame, 1 / 60 on the first. Covers any pause; the fade handles it. */
  readonly dt: number;
  /** Canvas size in backing pixels: device pixels times look.resolution. */
  readonly width: number;
  readonly height: number;
};

/**
 * Where a producer writes one frame of geometry. Coordinates are clip space,
 * -1 to 1 on both axes, y up. The screen owns the buffer and reuses it.
 */
export interface FrameWriter {
  /**
   * Seconds of beam time from the previous point to each point written after
   * this call. May change mid-strip. Resets to 1 / 48000 every frame.
   */
  pointDuration(seconds: number): void;
  /** Starts a strip of `trace`. Points connect only within a strip. */
  strip(trace: TraceIndex): void;
  /** Appends (x, y) with the current duration. Points past the frame's capacity are dropped and counted. */
  point(x: number, y: number): void;
}

/**
 * "draw": fade the history, deposit what was written, composite.
 * "hold": leave the history as it is (frozen). The screen recomposites only
 * when the size or the look changed, so a frozen screen costs no GPU work.
 */
export type ProduceResult = "draw" | "hold";

export type Producer = (frame: FrameInfo, out: FrameWriter) => ProduceResult;

export type PauseReason = "hidden" | "offscreen" | "collapsed";

export type ScreenError =
  /** Neither backend is available, or the forced one is missing. */
  | { readonly kind: "unsupported" }
  | { readonly kind: "init-failed"; readonly message: string }
  /** Recovery exhausted, or no adapter on recovery. */
  | { readonly kind: "device-lost"; readonly message: string };

export type ScreenStatus =
  | { readonly kind: "starting" }
  | {
      readonly kind: "running";
      readonly backend: Backend;
      readonly hdr: boolean;
    }
  | { readonly kind: "paused"; readonly reason: PauseReason }
  | { readonly kind: "recovering"; readonly attempt: 1 | 2 | 3 }
  | { readonly kind: "failed"; readonly error: ScreenError };

export interface PhosphorScreen {
  /** The same object until the status changes, so it works as a useSyncExternalStore snapshot. */
  getStatus(): ScreenStatus;
  subscribe(listener: () => void): () => void;
  /** Applies a new look, clamped to LOOK_LIMITS. Trace colors re-resolve only when `traces`, `screen`, or `ground` changes. */
  setLook(look: PhosphorLook): void;
  setProducer(produce: Producer): void;
  /** Wipes the history, as on a mode change: to the background on the screen ground, to black on the others. */
  clear(): void;
  /** PNG of the current composite. Recomposites, then toBlob in the same task. */
  snapshot(): Promise<Blob>;
  /**
   * Stops the loop, disconnects observers, and frees the backend's GPU
   * objects. WebGPU destroys its device. WebGL2 deletes its own objects and
   * leaves the context, which belongs to the canvas. Idempotent.
   */
  destroy(): void;
}
