import { resolveTraces } from "./colors";
import {
  SCREEN_UNIFORM_FLOATS,
  frameUniforms,
  packScreenUniforms,
} from "./exposure";
import { DEFAULT_POINT_DURATION, createFrameBuffer } from "./frame-buffer";
import { SCREEN_PRESETS, clampLook } from "./presets";
import { planRecovery } from "./recovery";
import type { AcquireRenderer, Renderer, RendererLoss } from "./renderer";
import type {
  Backend,
  PauseReason,
  PhosphorLook,
  PhosphorScreen,
  Producer,
  ScreenError,
  ScreenStatus,
  TraceColor,
} from "./types";
import { acquireWebGl2 } from "./webgl2";
import { acquireWebGpu } from "./webgpu";

const RENDERERS = {
  webgpu: acquireWebGpu,
  webgl2: acquireWebGl2,
} as const satisfies Record<Backend, AcquireRenderer>;

const AUTO: readonly Backend[] = ["webgpu", "webgl2"];

type Phase =
  | { readonly kind: "starting" }
  | {
      readonly kind: "ready";
      readonly renderer: Renderer;
      readonly acquire: AcquireRenderer;
    }
  | {
      readonly kind: "recovering";
      readonly acquire: AcquireRenderer;
      readonly attempt: 1 | 2 | 3;
    }
  | { readonly kind: "failed"; readonly error: ScreenError }
  | { readonly kind: "destroyed" };

type Size = { readonly width: number; readonly height: number };

/** Why the loop should not run, in order of precedence, or null to run. */
function pauseReason(
  hidden: boolean,
  size: Size | null,
  intersecting: boolean
): PauseReason | null {
  if (hidden) return "hidden";

  if (!size || size.width < 1 || size.height < 1) return "collapsed";

  return intersecting ? null : "offscreen";
}

const sameTraces = (a: readonly TraceColor[], b: readonly TraceColor[]) =>
  a.length === b.length && a.every((color, index) => color === b[index]);

/**
 * Starts a screen on `canvas`. `backend` is a preference: "auto", the
 * default, tries WebGPU first. The canvas keeps the first context type it
 * gets, so a backend that takes the canvas and then fails ends the screen.
 * The screen returns "starting" and changes status only after it returns,
 * so a caller that subscribes right away sees every change.
 */
export function createPhosphorScreen(
  canvas: HTMLCanvasElement,
  init: {
    readonly look: PhosphorLook;
    readonly produce: Producer;
    readonly backend?: Backend | "auto";
  }
): PhosphorScreen {
  let look = clampLook(init.look);
  let produce = init.produce;
  let phase: Phase = { kind: "starting" };
  let status: ScreenStatus = { kind: "starting" };
  let hdr = false;
  let hidden = document.hidden;
  let intersecting = false;
  let cssSize: Size | null = null;
  let deviceSize: Size | null = null;
  let frame = 0;
  let lastNow: number | null = null;
  let needsComposite = false;
  let losses: readonly number[] = [];
  let retry: ReturnType<typeof setTimeout> | undefined;
  let resolutionQuery: MediaQueryList | null = null;
  const listeners = new Set<() => void>();
  // Aborted by destroy(), so a wait for a WebGL2 restore ends with the screen.
  const lifetime = new AbortController();
  const frameBuffer = createFrameBuffer();
  const uniforms = new Float32Array(SCREEN_UNIFORM_FLOATS);
  const hdrQuery = matchMedia("(dynamic-range: high)");

  const publish = (next: ScreenStatus) => {
    if (JSON.stringify(next) === JSON.stringify(status)) return;
    status = next;

    for (const listener of listeners) listener();
  };

  const statusOf = (pause: PauseReason | null): ScreenStatus => {
    switch (phase.kind) {
      case "ready":
        return pause
          ? { kind: "paused", reason: pause }
          : { kind: "running", backend: phase.renderer.backend, hdr };
      case "recovering":
        return { kind: "recovering", attempt: phase.attempt };
      case "failed":
        return { kind: "failed", error: phase.error };
      default:
        return { kind: "starting" };
    }
  };

  /** Reconciles the frame callback and the status with the current state. Safe to call any time. */
  const sync = () => {
    if (phase.kind === "destroyed") return;
    const pause = pauseReason(hidden, deviceSize, intersecting);
    const run = phase.kind === "ready" && pause === null;

    if (run && frame === 0) frame = requestAnimationFrame(tick);
    else if (!run && frame !== 0) {
      cancelAnimationFrame(frame);
      frame = 0;
    }

    publish(statusOf(pause));
  };

  const pack = (dt: number, meanDt: number) =>
    packScreenUniforms(
      frameUniforms(look, {
        width: canvas.width,
        height: canvas.height,
        devicePixelRatio: (window.devicePixelRatio || 1) * look.resolution,
        dt,
        meanDt,
      }),
      uniforms
    );

  /**
   * Applies the observed size, scaled by look.resolution, to the canvas and
   * the history. Every size observation lands in deviceSize, so this is the
   * one place the scale applies. Returns whether the size changed.
   */
  const applySize = (renderer: Renderer) => {
    if (!deviceSize) return false;

    const width = Math.min(
      Math.max(1, Math.round(deviceSize.width * look.resolution)),
      renderer.maxSize
    );

    const height = Math.min(
      Math.max(1, Math.round(deviceSize.height * look.resolution)),
      renderer.maxSize
    );

    if (canvas.width === width && canvas.height === height) return false;
    canvas.width = width;
    canvas.height = height;
    renderer.resize(width, height);

    return true;
  };

  function tick(now: number) {
    frame = 0;

    if (phase.kind !== "ready") return;
    const { renderer } = phase;

    try {
      if (applySize(renderer)) needsComposite = true;
      const dt =
        lastNow === null ? 1 / 60 : Math.max(0, (now - lastNow) / 1000);
      lastNow = now;
      frameBuffer.reset();

      const result = produce(
        { now, dt, width: canvas.width, height: canvas.height },
        frameBuffer.writer
      );

      if (result === "draw") {
        frameBuffer.finish();
        renderer.draw(pack(dt, frameBuffer.meanDt()), look.beam, frameBuffer);
      } else if (needsComposite) {
        renderer.composite(pack(0, DEFAULT_POINT_DURATION));
      }

      needsComposite = false;
    } catch (error) {
      console.error("[kevelle/phosphor]", error);
      fail({
        kind: "init-failed",
        message: error instanceof Error ? error.message : String(error),
      });

      return;
    }

    sync();
  }

  const fail = (error: ScreenError) => {
    if (phase.kind === "ready") phase.renderer.destroy();
    phase = { kind: "failed", error };
    sync();
  };

  const output = () => ({
    ground: look.ground,
    hdr: look.hdr && hdrQuery.matches,
  });

  /** The history's clear level. Off the screen ground, any lift would show as a veil over the page. */
  const historyLevel = () => (look.ground === "screen" ? look.background : 0);

  const adopt = (renderer: Renderer, acquire: AcquireRenderer) => {
    phase = { kind: "ready", renderer, acquire };
    renderer.setTraces(
      resolveTraces(canvas, look.traces, SCREEN_PRESETS[look.screen])
    );
    hdr = renderer.setOutput(output());
    renderer.clear(historyLevel());
    needsComposite = true;
    sync();
  };

  const recover = (
    acquire: AcquireRenderer,
    message: string,
    restored?: RendererLoss["restored"]
  ) => {
    const plan = planRecovery(losses, performance.now());

    if (plan.kind === "give-up") {
      fail({
        kind: "device-lost",
        message: `The GPU device was lost four times within a minute (${message}). Reload the page to try again.`,
      });

      return;
    }

    losses = plan.losses;
    phase = { kind: "recovering", acquire, attempt: plan.attempt };
    sync();

    const wait =
      restored?.(lifetime.signal) ??
      new Promise<void>((resolve) => {
        retry = setTimeout(resolve, plan.delayMs);
      });

    void wait.then(async () => {
      if (phase.kind !== "recovering") return;
      const result = await acquire(canvas, onLost);

      if (phase.kind !== "recovering") {
        if (result.kind === "ready") result.renderer.destroy();

        return;
      }

      if (result.kind === "ready") adopt(result.renderer, acquire);
      else if (result.kind === "failed") recover(acquire, result.message);
      else
        fail({
          kind: "device-lost",
          message:
            "The GPU is no longer available. Reload the page to try again.",
        });
    });
  };

  function onLost(loss: RendererLoss) {
    if (phase.kind !== "ready") return;
    const { renderer, acquire } = phase;
    renderer.destroy();
    recover(acquire, loss.message, loss.restored);
  }

  const start = async () => {
    const preference = init.backend ?? "auto";

    for (const backend of preference === "auto" ? AUTO : [preference]) {
      const acquire = RENDERERS[backend];
      const result = await acquire(canvas, onLost);

      if (phase.kind !== "starting") {
        if (result.kind === "ready") result.renderer.destroy();

        return;
      }

      if (result.kind === "ready") return adopt(result.renderer, acquire);

      if (result.kind === "failed")
        return fail({ kind: "init-failed", message: result.message });
    }

    fail({ kind: "unsupported" });
  };

  const applyOutput = () => {
    if (phase.kind !== "ready") return;
    hdr = phase.renderer.setOutput(output());
    needsComposite = true;
    sync();
  };

  const onVisibility = () => {
    hidden = document.hidden;
    sync();
  };

  const intersection = new IntersectionObserver(
    (entries) => {
      intersecting = entries.at(-1)?.isIntersecting ?? intersecting;
      sync();
    },
    { threshold: 0 }
  );

  const scaled = (size: Size): Size => ({
    width: Math.round(size.width * window.devicePixelRatio),
    height: Math.round(size.height * window.devicePixelRatio),
  });

  const onResolution = () => {
    if (cssSize) deviceSize = scaled(cssSize);
    watchResolution();
    sync();
  };

  /** Re-arms the query for the current ratio; it fires once when the ratio leaves it. */
  function watchResolution() {
    resolutionQuery?.removeEventListener("change", onResolution);
    resolutionQuery = matchMedia(
      `(resolution: ${window.devicePixelRatio}dppx)`
    );
    resolutionQuery.addEventListener("change", onResolution);
  }

  const resize = new ResizeObserver((entries) => {
    const entry = entries.at(-1);

    if (!entry) return;
    const box = entry.contentBoxSize[0];
    cssSize = { width: box.inlineSize, height: box.blockSize };
    const estimate = scaled(cssSize);
    const pixels = entry.devicePixelContentBoxSize?.[0];

    // The device-pixel box is exact where it agrees with the ratio. Chromium's
    // device emulation reports CSS pixels in it while devicePixelRatio is
    // emulated, so a box that disagrees by more than a pixel loses to the ratio.
    deviceSize =
      pixels &&
      Math.abs(pixels.inlineSize - estimate.width) <= 1 &&
      Math.abs(pixels.blockSize - estimate.height) <= 1
        ? { width: pixels.inlineSize, height: pixels.blockSize }
        : estimate;
    sync();
  });

  try {
    resize.observe(canvas, { box: "device-pixel-content-box" });
  } catch {
    resize.observe(canvas, { box: "content-box" });
    watchResolution();
  }

  intersection.observe(canvas);
  document.addEventListener("visibilitychange", onVisibility);
  hdrQuery.addEventListener("change", applyOutput);
  queueMicrotask(() => void start());

  return {
    getStatus: () => status,
    subscribe(listener) {
      listeners.add(listener);

      return () => listeners.delete(listener);
    },
    setLook(next) {
      const previous = look;
      look = clampLook(next);

      if (phase.kind === "ready") {
        // A theme switch flips the ground, and the tokens take the new
        // theme's values, so a ground change reads them again.
        if (
          look.screen !== previous.screen ||
          look.ground !== previous.ground ||
          !sameTraces(look.traces, previous.traces)
        ) {
          phase.renderer.setTraces(
            resolveTraces(canvas, look.traces, SCREEN_PRESETS[look.screen])
          );
        }

        if (look.hdr !== previous.hdr || look.ground !== previous.ground)
          hdr = phase.renderer.setOutput(output());
      }

      needsComposite = true;
      sync();
    },
    setProducer(next) {
      produce = next;
    },
    clear() {
      if (phase.kind !== "ready") return;
      phase.renderer.clear(historyLevel());
      needsComposite = true;
    },
    snapshot() {
      if (phase.kind !== "ready")
        return Promise.reject(new Error("The phosphor screen is not running."));
      phase.renderer.composite(pack(0, DEFAULT_POINT_DURATION));

      // toBlob reads the drawing buffer now, in the task that composited it.
      return new Promise<Blob>((resolve, reject) => {
        canvas.toBlob((blob) => {
          if (blob) resolve(blob);
          else reject(new Error("The canvas produced no image."));
        }, "image/png");
      });
    },
    destroy() {
      if (phase.kind === "destroyed") return;

      if (phase.kind === "ready") phase.renderer.destroy();
      phase = { kind: "destroyed" };
      cancelAnimationFrame(frame);
      frame = 0;
      clearTimeout(retry);
      lifetime.abort();
      resize.disconnect();
      intersection.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
      hdrQuery.removeEventListener("change", applyOutput);
      resolutionQuery?.removeEventListener("change", onResolution);
      listeners.clear();
    },
  };
}
