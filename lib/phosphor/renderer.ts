import type { ResolvedTrace } from "./colors";
import type { FrameBuffer } from "./frame-buffer";
import type { Backend, BeamStyle, Ground } from "./types";

/** How the canvas presents the composite: the ground it sits on, and whether HDR is wanted. */
export type Output = { readonly ground: Ground; readonly hdr: boolean };

export type Renderer = {
  readonly backend: Backend;
  /** The largest canvas side the backend can draw. */
  readonly maxSize: number;
  /**
   * Resizes the history to the canvas's new size, resampling the old history
   * into it so the afterglow survives. The screen sets the canvas size first.
   */
  resize(width: number, height: number): void;
  setTraces(traces: readonly ResolvedTrace[]): void;
  /**
   * Configures the canvas and the composite for `output.ground`: opaque on
   * the screen ground, premultiplied on the others. The output is HDR when
   * `output.hdr` asks, the ground has an HDR composite (screen and dark), and
   * the backend confirms extended tone mapping. Returns whether it is HDR.
   * The screen calls it when it adopts the renderer, so the canvas ends up
   * configured for the renderer it adopted last.
   */
  setOutput(output: Output): boolean;
  /** Fades the history, deposits the frame's strips, and composites. */
  draw(uniforms: Float32Array, beam: BeamStyle, geometry: FrameBuffer): void;
  /** Composites the history as it is, without fading or depositing. */
  composite(uniforms: Float32Array): void;
  /** Fills every channel of the history with `level`. */
  clear(level: number): void;
  /** Releases everything the renderer owns. Idempotent. */
  destroy(): void;
};

/** A loss the renderer did not cause, reported once. */
export type RendererLoss = {
  readonly message: string;
  /**
   * Resolves when the backend can be acquired again, as WebGL2 does on
   * webglcontextrestored, and stops listening when `signal` aborts. Without
   * it, the screen retries on its backoff schedule.
   */
  readonly restored?: (signal: AbortSignal) => Promise<void>;
};

export type Acquisition =
  | { readonly kind: "ready"; readonly renderer: Renderer }
  /** No API, adapter, or device. The canvas has no context yet, so another backend may still take it. */
  | { readonly kind: "missing" }
  /** The backend took the canvas and then failed. */
  | { readonly kind: "failed"; readonly message: string };

export type AcquireRenderer = (
  canvas: HTMLCanvasElement,
  onLost: (loss: RendererLoss) => void
) => Promise<Acquisition>;
