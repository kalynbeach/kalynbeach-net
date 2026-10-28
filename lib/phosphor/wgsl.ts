import type { Ground } from "./types";

/** Dynamic-offset stride of the Trace uniform: WebGPU's default minUniformBufferOffsetAlignment. */
export const TRACE_UNIFORM_STRIDE = 256;

const SCREEN = /* wgsl */ `
struct Screen {
  fade: vec4f,      // rgb per-channel fade, a fadeAlpha
  toneK: vec4f,     // rgb tone map k, a HDR headroom
  tint: vec4f,      // rgb screen tint, a backgroundLift
  core: vec4f,      // rgb hot core, a glowSpread
  floorMix: vec4f,  // rgb floor share, a bloomStrength
  texel: vec4f,     // xy texel size, z traceGain, w traceAlpha
  beam: vec4f,      // x sigma px, y beamPower, zw viewport px
  decay: vec4f,     // rgb age rate per second, a lineExposure
};
@group(0) @binding(0) var<uniform> screen: Screen;
`;

const TRACE = /* wgsl */ `
struct Trace {
  emission: vec4f,
  shoulder: vec4f,
};
@group(1) @binding(0) var<uniform> trace: Trace;

// The predecessor's trace color: (emission * traceGain + shoulder * bloomStrength).
fn traceLight() -> vec3f {
  return trace.emission.rgb * screen.texel.z + trace.shoulder.rgb * screen.floorMix.a;
}
`;

/** The predecessor's full-screen triangle, with uv (0, 0) at the top left. */
const FULLSCREEN = /* wgsl */ `
struct FullscreenOut {
  @builtin(position) position: vec4f,
  @location(0) uv: vec2f,
};

@vertex
fn vs(@builtin(vertex_index) index: u32) -> FullscreenOut {
  var positions = array<vec2f, 3>(vec2f(-1.0, -3.0), vec2f(3.0, 1.0), vec2f(-1.0, 1.0));
  var uvs = array<vec2f, 3>(vec2f(0.0, 2.0), vec2f(2.0, 0.0), vec2f(0.0, 0.0));
  var out: FullscreenOut;
  out.position = vec4f(positions[index], 0.0, 1.0);
  out.uv = uvs[index];
  return out;
}
`;

/*
 * The fade pass blends color zero / one-minus-src and alpha one /
 * one-minus-src-alpha. For P31, fade.rgb is (fadeAlpha, fadeAlpha, fadeAlpha), so the blend
 * computes dst * (1 - fadeAlpha), the operations the predecessor's
 * src-alpha / one-minus-src-alpha blend of black performed.
 */
export const FADE_WGSL = /* wgsl */ `
${SCREEN}
${FULLSCREEN}
@fragment
fn fs() -> @location(0) vec4f {
  return screen.fade;
}
`;

/*
 * The line beam is the predecessor's 1px line strip, blended one / one. With
 * a lineExposure of exactly 1 its output equals the predecessor's.
 */
export const LINE_WGSL = /* wgsl */ `
${SCREEN}
${TRACE}
@vertex
fn vs(@location(0) point: vec2f) -> @builtin(position) vec4f {
  return vec4f(point.x, point.y, 0.0, 1.0);
}

@fragment
fn fs() -> @location(0) vec4f {
  return vec4f(traceLight() * screen.decay.a, screen.texel.w);
}
`;

/*
 * Gaussian beam, after woscope. Each segment p0 -> p1 is a quad reaching
 * 4 sigma past both ends and to both sides, and each pixel receives the
 * segment's energy integrated along a gaussian spot moving at constant speed:
 *
 *   across = exp(-y^2 / 2s^2) / (sqrt(2 pi) s)
 *   along  = (erf(x / (sqrt2 s)) - erf((x - L) / (sqrt2 s))) / 2L
 *
 * in device pixels, x along the segment and y across it. The integral over
 * the plane is the segment's energy for any length, so a fast segment spreads
 * the same energy thinner. Below L = 1e-3 px, along takes its analytic limit,
 * a gaussian of x, so a held point is a spot rather than a hot dot.
 *
 * Instance i reads p0 from slot 0 and p1 from slot 1, which is bound 16 bytes
 * (one point) further into the same buffer. Energy is beamPower * dt of p1,
 * weighted per channel by exp(-rate * age) of p1.
 */
export const BEAM_WGSL = /* wgsl */ `
${SCREEN}
${TRACE}
struct BeamOut {
  @builtin(position) position: vec4f,
  @location(0) local: vec2f,
  @location(1) @interpolate(flat) span: f32,
  @location(2) @interpolate(flat) energy: vec3f,
};

@vertex
fn vs(
  @builtin(vertex_index) index: u32,
  @location(0) p0: vec2f,
  @location(1) p1: vec4f,
) -> BeamOut {
  var corners = array<vec2f, 6>(
    vec2f(0.0, -1.0), vec2f(1.0, -1.0), vec2f(0.0, 1.0),
    vec2f(0.0, 1.0), vec2f(1.0, -1.0), vec2f(1.0, 1.0),
  );
  let corner = corners[index];
  let size = screen.beam.zw;
  let a = (p0 * 0.5 + 0.5) * size;
  let b = (p1.xy * 0.5 + 0.5) * size;
  let span = distance(a, b);
  var dir = vec2f(1.0, 0.0);
  if (span >= 1e-3) {
    dir = (b - a) / span;
  }
  let normal = vec2f(-dir.y, dir.x);
  let reach = 4.0 * screen.beam.x;
  let along = select(-reach, span + reach, corner.x > 0.5);
  let across = corner.y * reach;
  let pixel = a + dir * along + normal * across;
  var out: BeamOut;
  out.position = vec4f(pixel / size * 2.0 - 1.0, 0.0, 1.0);
  out.local = vec2f(along, across);
  out.span = span;
  out.energy = screen.beam.y * p1.z * exp(-screen.decay.rgb * p1.w);
  return out;
}

// Abramowitz and Stegun 7.1.27, |error| <= 5e-4.
fn erf(x: f32) -> f32 {
  let a = abs(x);
  var t = 1.0 + (0.278393 + (0.230389 + (0.000972 + 0.078108 * a) * a) * a) * a;
  t = t * t;
  return sign(x) * (1.0 - 1.0 / (t * t));
}

@fragment
fn fs(input: BeamOut) -> @location(0) vec4f {
  let sigma = screen.beam.x;
  let x = input.local.x;
  let y = input.local.y;
  let density = 1.0 / (2.5066283 * sigma);
  let across = exp(-(y * y) / (2.0 * sigma * sigma)) * density;
  var along = exp(-(x * x) / (2.0 * sigma * sigma)) * density;
  if (input.span >= 1e-3) {
    let k = 1.0 / (1.4142135 * sigma);
    along = (erf(x * k) - erf((x - input.span) * k)) / (2.0 * input.span);
  }
  return vec4f(traceLight() * input.energy * across * along, 0.0);
}
`;

/*
 * The composite is the predecessor's, with each color literal replaced by a
 * uniform holding the same value. Blur weights stay literals; they are the
 * kernel, not a phosphor property. The variants differ only in `tail`, the
 * lines after the hot core. The HDR tails alone lift the hot core by
 * 1 + (headroom - 1) * highlight; the screen's SDR tail never contains that
 * factor, so it computes the predecessor's arithmetic.
 */
function compositeWgsl(tail: string) {
  return /* wgsl */ `
${SCREEN}
@group(1) @binding(0) var historyTexture: texture_2d<f32>;
@group(1) @binding(1) var historySampler: sampler;
${FULLSCREEN}
fn sampleHistory(uv: vec2f, offset: vec2f) -> vec3f {
  return textureSample(historyTexture, historySampler, uv + offset).rgb;
}

@fragment
fn fs(input: FullscreenOut) -> @location(0) vec4f {
  let texel = screen.texel.xy * screen.core.a;
  let outerTexel = texel * 2.0;
  let center = sampleHistory(input.uv, vec2f(0.0, 0.0));
  let blur =
      center * 0.2 +
      sampleHistory(input.uv, vec2f(texel.x, 0.0)) * 0.13 +
      sampleHistory(input.uv, vec2f(-texel.x, 0.0)) * 0.13 +
      sampleHistory(input.uv, vec2f(0.0, texel.y)) * 0.13 +
      sampleHistory(input.uv, vec2f(0.0, -texel.y)) * 0.13 +
      sampleHistory(input.uv, vec2f(texel.x, texel.y)) * 0.055 +
      sampleHistory(input.uv, vec2f(-texel.x, texel.y)) * 0.055 +
      sampleHistory(input.uv, vec2f(texel.x, -texel.y)) * 0.055 +
      sampleHistory(input.uv, vec2f(-texel.x, -texel.y)) * 0.055;
  let halo =
      sampleHistory(input.uv, vec2f(outerTexel.x, 0.0)) * 0.03 +
      sampleHistory(input.uv, vec2f(-outerTexel.x, 0.0)) * 0.03 +
      sampleHistory(input.uv, vec2f(0.0, outerTexel.y)) * 0.03 +
      sampleHistory(input.uv, vec2f(0.0, -outerTexel.y)) * 0.03 +
      sampleHistory(input.uv, vec2f(outerTexel.x, outerTexel.y)) * 0.016 +
      sampleHistory(input.uv, vec2f(-outerTexel.x, outerTexel.y)) * 0.016 +
      sampleHistory(input.uv, vec2f(outerTexel.x, -outerTexel.y)) * 0.016 +
      sampleHistory(input.uv, vec2f(-outerTexel.x, -outerTexel.y)) * 0.016;
  let glow = max((blur + halo * 0.8) * (0.38 + screen.floorMix.a * 0.3) - center * 0.18, vec3f(0.0));
  let lit = center * (1.0 + screen.texel.z * 0.28) + glow;
  let mapped = vec3f(1.0) - exp(-lit * screen.toneK.rgb);
  let tinted = mapped * screen.tint.rgb;
  let highlight = smoothstep(0.52, 1.4, max(max(lit.r, lit.g), lit.b));
  let hotCore = mix(tinted, screen.core.rgb, highlight * 0.38);
${tail}
}
`;
}

const LIFTED = "hotCore * (1.0 + (screen.toneK.a - 1.0) * highlight)";

/** The opaque screen: the hot core over the background's floor, alpha 1. */
function screenTail(hot: string) {
  return /* wgsl */ `  let floor = screen.floorMix.rgb * screen.tint.a;
  return vec4f(max(${hot}, floor), 1.0);`;
}

/*
 * The light ground keeps the light's hue and spends its energy on alpha
 * alone. A gain of 1 saturates a dense figure to near-solid color over
 * white, and the ceiling stops alpha short of ink.
 */
const LIGHT_TAIL = /* wgsl */ `  const GAIN = 0.15;
  const CEILING = 0.7;
  let energy = max(max(lit.r, lit.g), lit.b);
  let alpha = CEILING * (1.0 - exp(-energy * GAIN));
  let hue = lit / max(energy, 1e-6);
  let encoded = select(1.055 * pow(hue, vec3f(1.0 / 2.4)) - 0.055, hue * 12.92, hue <= vec3f(0.0031308));
  return vec4f(encoded * alpha, alpha);`;

const COMPOSITE_SDR_WGSL = compositeWgsl(screenTail("hotCore"));

const COMPOSITE_HDR_WGSL = compositeWgsl(screenTail(LIFTED));

/**
 * The composite for each ground: SDR, and HDR where the ground has it. The
 * dark ground's alpha is its brightest channel, so its output stays
 * premultiplied. The light ground is never HDR.
 */
export const COMPOSITE_WGSL = {
  screen: { sdr: COMPOSITE_SDR_WGSL, hdr: COMPOSITE_HDR_WGSL },
  dark: {
    sdr: compositeWgsl(
      "  return vec4f(hotCore, max(max(hotCore.r, hotCore.g), hotCore.b));"
    ),
    hdr: compositeWgsl(`  let lifted = ${LIFTED};
  return vec4f(lifted, min(1.0, max(max(lifted.r, lifted.g), lifted.b)));`),
  },
  light: { sdr: compositeWgsl(LIGHT_TAIL), hdr: null },
} as const satisfies Record<
  Ground,
  { readonly sdr: string; readonly hdr: string | null }
>;

/** Draws the old history into a resized history texture, so the afterglow survives a resize. */
export const RESAMPLE_WGSL = /* wgsl */ `
@group(0) @binding(0) var source: texture_2d<f32>;
@group(0) @binding(1) var sourceSampler: sampler;
${FULLSCREEN}
@fragment
fn fs(input: FullscreenOut) -> @location(0) vec4f {
  return textureSample(source, sourceSampler, input.uv);
}
`;
