export { createPhosphorScreen } from "./screen";

/*
 * kevelle/phosphor: a phosphor screen for line geometry, with the KKB
 * Oscilloscope's persistence, bloom, and tone curve. It runs on WebGPU, or
 * on WebGL2 where WebGPU is missing. Kevelle's DESIGN.md describes the looks,
 * presets, beams, and trace colors.
 *
 * Import from this file only. Shaders, renderers, and the uniform layout are
 * internal. Framework-free: no React, no audio. Any producer can drive it.
 *
 * Usage. createPhosphorScreen(canvas, { look, produce, backend }) starts a
 * screen and returns its handle: getStatus() and subscribe() for the status,
 * setLook(), setProducer(), clear(), snapshot() for a PNG of the composite,
 * and destroy(). The screen calls produce(frame, out) once per frame. The
 * producer writes clip-space points into strips with out.strip(trace) and
 * out.point(x, y), sets the beam time between points with
 * out.pointDuration(seconds), and returns "draw", or "hold" to keep the
 * screen as it is. detectPhosphorSupport() reports which backend a screen
 * would use, and clampLook() clamps every number in a look into LOOK_LIMITS.
 *
 * Trace colors resolve from CSS custom properties on the canvas when the
 * screen starts, and again when setLook() changes traces, screen, or
 * ground. Nothing else re-reads them. A theme switch should flip the
 * ground, and that one setLook() picks up the new theme's tokens.
 *
 * Grounds. look.ground says what the canvas sits on. "screen", the default,
 * is the phosphor's own opaque screen, lifted by look.background. It is the
 * oscilloscope's composite, byte for byte. "dark" is transparent over a
 * dark page. It draws the screen's light without the floor, premultiplied,
 * with alpha at its brightest channel. "light" is transparent over a light
 * page. It draws the light's own hue in sRGB, with alpha rising with its
 * energy to a ceiling of 0.7, so a dense figure stays translucent and never
 * reads as ink. look.background lifts only the screen ground; on the others
 * the history clears to black.
 *
 * Resolution. look.resolution sets backing pixels per device pixel, from
 * 0.25 to 1. The canvas keeps its CSS size and the browser scales it up, so
 * a large blurred glow at 0.5 costs a quarter of the memory and fill. Focus
 * and the gaussian beam's energy stay in CSS pixels. The line beam stays one
 * backing pixel wide and the bloom works in backing texels, so both grow by
 * 1 / resolution on the page.
 *
 * Lifecycle. The screen owns its frame loop. The loop runs only while the
 * canvas intersects the viewport, the document is visible, and the canvas
 * has a size. Otherwise the status is "paused" with the reason. A resize
 * resamples the old history into the new one, so the afterglow survives. A
 * lost WebGPU device is replaced on a fresh adapter after 250 ms, 1 s, and
 * 4 s, with the status "recovering" and the attempt. A fourth loss within a
 * minute, or no adapter during recovery, fails the screen with
 * "device-lost". A lost WebGL2 context recovers when the browser restores
 * it. destroy() stops the loop and frees the backend's GPU objects.
 * ./screen.ts has the details.
 *
 * Backends. backend: "auto" tries WebGPU first and falls back to WebGL2 on
 * the same canvas, because WebGPU requests its adapter and device before it
 * takes the canvas. A canvas keeps its first context, so a new backend needs
 * a new canvas. Both backends run the same passes with the same math: the
 * fade, the line or gaussian deposit into a half-float history, the
 * composite, and the resample on resize. The two APIs rasterize lines a
 * fraction of a pixel apart.
 *
 * HDR. look.hdr asks for HDR output and is off by default. The screen grants
 * it only on WebGPU and on the screen and dark grounds, when
 * (dynamic-range: high) matches and the canvas confirms extended tone
 * mapping on an rgba16float configuration. The HDR composite lifts the hot
 * core up to twice SDR white. The SDR composite never contains that factor,
 * so an extended configuration with the SDR composite is not HDR. The screen
 * reconfigures when the media query changes and when setLook() changes hdr
 * or ground. WebGL2 and the light ground are always SDR.
 *
 * Parity. P31 with the line beam runs the oscilloscope's arithmetic in every
 * pass (./presets.ts, ./exposure.ts). The screen deposits light per second of
 * beam time and matches the oscilloscope at REFERENCE_HZ, 60, so a trace
 * keeps its brightness on a faster display. look.intensity scales the
 * energy of both beams, and 1, the default, is the original oscilloscope at
 * 60 Hz. The gaussian beam integrates the spot in woscope's erf form and
 * weights each segment by its age within the frame, so a long frame shows
 * no brightness step.
 */

export { detectPhosphorSupport } from "./support";

export {
  DEFAULT_LOOK,
  LOOK_LIMITS,
  MAX_TRACES,
  SCREEN_PRESETS,
  clampLook,
} from "./presets";

// One frame holds MAX_POINTS points in MAX_STRIPS strips, and drops what a producer writes past either.
export { MAX_POINTS, MAX_STRIPS } from "./frame-buffer";

export type { ScreenPreset } from "./presets";

export type {
  Backend,
  BeamStyle,
  FrameInfo,
  FrameWriter,
  Ground,
  PauseReason,
  PhosphorLook,
  PhosphorScreen,
  PhosphorSupport,
  ProduceResult,
  Producer,
  Rgb,
  ScreenError,
  ScreenPresetId,
  ScreenStatus,
  SignalColor,
  TraceColor,
  TraceIndex,
} from "./types";
