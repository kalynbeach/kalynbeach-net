import { SCREEN_PRESETS } from "./presets";
import type { PhosphorLook, Rgb } from "./types";

/**
 * The refresh rate the predecessor's look was tuned at. It drew a fixed
 * number of points per frame, so its brightness doubled at 120 Hz. This
 * screen deposits per second of beam time instead, and matches the
 * predecessor exactly at this rate.
 */
export const REFERENCE_HZ = 60;

/** Highlights reach twice SDR white on an HDR canvas. */
export const HDR_HEADROOM = 2;

/**
 * Gaussian beam energy per unit of line exposure. At 1, a segment deposits
 * the line beam's per-pixel exposure times dpr^2 in total. The line saturates
 * the tone map in its 1px core and wastes most of its light there, so a
 * gaussian that deposits the line's energy (near 6.5 on the Circle preset)
 * reads far brighter. At 6 its mean green is 7.47 against the line's 5.23 out
 * of 255. Tuned on the Circle preset at a device pixel ratio of 2, where 1
 * gives a mean green of 5.26, matching the line figure's composite.
 */
export const BEAM_ENERGY = 1;

/** f32 slots in the Screen uniform block: 8 vec4f. */
export const SCREEN_UNIFORM_FLOATS = 32;

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

/** The predecessor's eight uniform values, plus the per-60 Hz-frame retention the additions derive from. */
export type ClassicUniforms = {
  readonly backgroundLift: number;
  readonly bloomStrength: number;
  readonly fadeAlpha: number;
  readonly glowSpread: number;
  readonly texelSizeX: number;
  readonly texelSizeY: number;
  readonly traceAlpha: number;
  readonly traceGain: number;
  /** 1 - fadeAlpha at 60 Hz, the share of the history one 60 Hz frame keeps. */
  readonly retained60: number;
};

/**
 * The predecessor's createRendererUniformValues, with the same operations in
 * the same order and the same clamps. `persistence` is its trailLength and
 * `background` its canvas.background.
 */
export function classicUniforms(
  persistence: number,
  bloom: number,
  background: number,
  width: number,
  height: number,
  dt: number
): ClassicUniforms {
  const safeWidth = Math.max(1, width);
  const safeHeight = Math.max(1, height);
  const bloomStrength = clamp(bloom, 0, 1.5);
  const trailLength = Math.max(16, persistence);
  const trailBlend = clamp((trailLength - 16) / 112, 0, 1);

  const fadeAlphaAtSixtyHertz = clamp(
    (0.24 + trailBlend * 0.1) / Math.sqrt(trailLength),
    0.016,
    0.08
  );

  const retainedAtSixtyHertz = 1 - fadeAlphaAtSixtyHertz;
  const normalizedFrames = Math.max(0, dt) * 60;
  const fadeAlpha = clamp(1 - retainedAtSixtyHertz ** normalizedFrames, 0, 1);

  return {
    backgroundLift: clamp(
      clamp(background, 0, 1) * 0.35 +
        bloomStrength * 0.006 +
        trailBlend * 0.004,
      0,
      0.05
    ),
    bloomStrength,
    fadeAlpha,
    glowSpread: clamp(
      0.85 + bloomStrength * 1.45 + trailBlend * 0.35,
      0.85,
      3.4
    ),
    texelSizeX: 1 / safeWidth,
    texelSizeY: 1 / safeHeight,
    traceAlpha: clamp(0.004 + (1 - trailBlend) * 0.016, 0.004, 0.02),
    traceGain: clamp(0.74 + bloomStrength * 0.22, 0.74, 1.08),
    retained60: retainedAtSixtyHertz,
  };
}

/** The predecessor's points per frame for a persistence: clamp(round(p) * 8, 256, 4096). */
export function referencePoints(persistence: number) {
  return clamp(Math.round(persistence) * 8, 256, 4096);
}

/**
 * Line beam deposit scale: referencePoints * REFERENCE_HZ * meanDt, where
 * meanDt is the frame's mean point duration. At 48 kHz and persistence 64
 * that is 0.64, so the 800 points of a 60 Hz frame deposit what the
 * predecessor's 512 did. It normalizes the whole frame only, so a line's
 * brightness never depends on its own points' durations.
 */
export function lineExposure(persistence: number, meanDt: number) {
  return referencePoints(persistence) * REFERENCE_HZ * meanDt;
}

/**
 * The fade this frame per channel. With decay 1 a channel computes the
 * predecessor's fadeAlpha bit for bit, because multiplying by 1 is exact.
 */
export function channelFade(retained60: number, dt: number, decay: Rgb): Rgb {
  const frames = Math.max(0, dt) * 60;

  return [
    clamp(1 - retained60 ** (frames * decay[0]), 0, 1),
    clamp(1 - retained60 ** (frames * decay[1]), 0, 1),
    clamp(1 - retained60 ** (frames * decay[2]), 0, 1),
  ];
}

/**
 * The frame fade as a rate per second per channel, so the gaussian beam can
 * weight a point by exp(-rate * age) and a frame shows no brightness steps.
 */
export function ageRates(retained60: number, decay: Rgb): Rgb {
  const perSecond = -REFERENCE_HZ * Math.log(retained60);

  return [perSecond * decay[0], perSecond * decay[1], perSecond * decay[2]];
}

/**
 * Gaussian beam energy per second of beam time. The dpr^2 keeps the look the
 * same at any pixel ratio. A segment's length and its sigma both scale with
 * the ratio, and the peak deposit falls with their product.
 */
export function beamPower(
  persistence: number,
  intensity: number,
  devicePixelRatio: number
) {
  return (
    referencePoints(persistence) *
    REFERENCE_HZ *
    intensity *
    BEAM_ENERGY *
    devicePixelRatio ** 2
  );
}

/** Everything the Screen uniform block holds for one frame. */
export type ScreenUniforms = {
  readonly classic: ClassicUniforms;
  readonly fade: Rgb;
  readonly toneK: Rgb;
  /** HDR_HEADROOM; read only by the HDR composite. */
  readonly headroom: number;
  readonly tint: Rgb;
  readonly core: Rgb;
  readonly floor: Rgb;
  readonly sigma: number;
  readonly beamPower: number;
  readonly width: number;
  readonly height: number;
  readonly rates: Rgb;
  readonly lineExposure: number;
};

/** What one frame's uniforms depend on besides the look. */
export type FrameExposure = {
  /** Canvas size in device pixels. */
  readonly width: number;
  readonly height: number;
  readonly devicePixelRatio: number;
  /** Seconds since the previous frame; 0 recomposites without fading. */
  readonly dt: number;
  /** The frame's mean point duration, from FrameBuffer.meanDt(). */
  readonly meanDt: number;
};

/**
 * The Screen block's values for one frame of `look`. The screen packs them
 * as they are. look.intensity scales both beams' energy, and at 1 the line
 * beam deposits exactly what the predecessor did at 60 Hz. The parity
 * harness overrides lineExposure only, so its uniforms cannot drift from
 * the screen's.
 */
export function frameUniforms(
  look: PhosphorLook,
  frame: FrameExposure
): ScreenUniforms {
  const preset = SCREEN_PRESETS[look.screen];

  const classic = classicUniforms(
    look.persistence,
    look.bloom,
    look.background,
    frame.width,
    frame.height,
    frame.dt
  );

  return {
    classic,
    fade: channelFade(classic.retained60, frame.dt, preset.decay),
    toneK: preset.toneK,
    headroom: HDR_HEADROOM,
    tint: preset.tint,
    core: preset.core,
    floor: preset.floor,
    sigma: look.focus * frame.devicePixelRatio,
    beamPower: beamPower(
      look.persistence,
      look.intensity,
      frame.devicePixelRatio
    ),
    width: frame.width,
    height: frame.height,
    rates: ageRates(classic.retained60, preset.decay),
    lineExposure: lineExposure(look.persistence, frame.meanDt) * look.intensity,
  };
}

/**
 * Writes `u` into `target` in the Screen block's layout, the same in WGSL and
 * in a std140 GLSL block. Returns `target`.
 *
 *   fade      rgb per-channel fade, a fadeAlpha
 *   toneK     rgb tone map k, a HDR headroom
 *   tint      rgb screen tint, a backgroundLift
 *   core      rgb hot core, a glowSpread
 *   floorMix  rgb floor share, a bloomStrength
 *   texel     xy texel size, z traceGain, w traceAlpha
 *   beam      x sigma (device px), y beamPower, zw viewport size (device px)
 *   decay     rgb age rate per second, a lineExposure
 */
export function packScreenUniforms(u: ScreenUniforms, target: Float32Array) {
  const { classic } = u;
  target.set(u.fade, 0);
  target[3] = classic.fadeAlpha;
  target.set(u.toneK, 4);
  target[7] = u.headroom;
  target.set(u.tint, 8);
  target[11] = classic.backgroundLift;
  target.set(u.core, 12);
  target[15] = classic.glowSpread;
  target.set(u.floor, 16);
  target[19] = classic.bloomStrength;
  target[20] = classic.texelSizeX;
  target[21] = classic.texelSizeY;
  target[22] = classic.traceGain;
  target[23] = classic.traceAlpha;
  target[24] = u.sigma;
  target[25] = u.beamPower;
  target[26] = u.width;
  target[27] = u.height;
  target.set(u.rates, 28);
  target[31] = u.lineExposure;

  return target;
}
