import type { Ground } from "./types";

/** The uniform buffer binding point of the Screen block. */
export const SCREEN_BINDING = 0;

const HEADER = /* glsl */ `#version 300 es
precision highp float;
`;

const SCREEN = /* glsl */ `
layout(std140) uniform Screen {
  vec4 fade;      // rgb per-channel fade, a fadeAlpha
  vec4 toneK;     // rgb tone map k, a HDR headroom
  vec4 tint;      // rgb screen tint, a backgroundLift
  vec4 core;      // rgb hot core, a glowSpread
  vec4 floorMix;  // rgb floor share, a bloomStrength
  vec4 texel;     // xy texel size, z traceGain, w traceAlpha
  vec4 beam;      // x sigma px, y beamPower, zw viewport px
  vec4 decay;     // rgb age rate per second, a lineExposure
} screen;
`;

const TRACE = /* glsl */ `
uniform vec3 traceEmission;
uniform vec3 traceShoulder;

// The predecessor's trace color: (emission * traceGain + shoulder * bloomStrength).
vec3 traceLight() {
  return traceEmission * screen.texel.z + traceShoulder * screen.floorMix.a;
}
`;

/** The predecessor's full-screen triangle, with uv (0, 0) at the bottom left. */
export const FULLSCREEN_VERTEX = /* glsl */ `${HEADER}
const vec2 POSITIONS[3] = vec2[3](vec2(-1.0, -3.0), vec2(3.0, 1.0), vec2(-1.0, 1.0));
out vec2 uv;

void main() {
  vec2 position = POSITIONS[gl_VertexID];
  uv = position * 0.5 + 0.5;
  gl_Position = vec4(position, 0.0, 1.0);
}
`;

/* Blended color zero / one-minus-src, alpha one / one-minus-src-alpha, as in ./wgsl.ts. */
export const FADE_FRAGMENT = /* glsl */ `${HEADER}${SCREEN}
out vec4 color;

void main() {
  color = screen.fade;
}
`;

export const LINE_VERTEX = /* glsl */ `${HEADER}
layout(location = 0) in vec2 point;

void main() {
  gl_Position = vec4(point, 0.0, 1.0);
}
`;

export const LINE_FRAGMENT = /* glsl */ `${HEADER}${SCREEN}${TRACE}
out vec4 color;

void main() {
  color = vec4(traceLight() * screen.decay.a, screen.texel.w);
}
`;

/*
 * The gaussian beam of ./wgsl.ts. Attribute 0 reads p0 and attribute 1 reads
 * p1, both per instance; the renderer points them one point apart at each
 * strip's start.
 */
export const BEAM_VERTEX = /* glsl */ `${HEADER}${SCREEN}
const vec2 CORNERS[6] = vec2[6](
  vec2(0.0, -1.0), vec2(1.0, -1.0), vec2(0.0, 1.0),
  vec2(0.0, 1.0), vec2(1.0, -1.0), vec2(1.0, 1.0)
);
layout(location = 0) in vec2 p0;
layout(location = 1) in vec4 p1;
out vec2 local;
flat out float span;
flat out vec3 energy;

void main() {
  vec2 corner = CORNERS[gl_VertexID];
  vec2 size = screen.beam.zw;
  vec2 a = (p0 * 0.5 + 0.5) * size;
  vec2 b = (p1.xy * 0.5 + 0.5) * size;
  float segment = distance(a, b);
  vec2 dir = vec2(1.0, 0.0);
  if (segment >= 1e-3) {
    dir = (b - a) / segment;
  }
  vec2 normal = vec2(-dir.y, dir.x);
  float reach = 4.0 * screen.beam.x;
  float along = corner.x > 0.5 ? segment + reach : -reach;
  float across = corner.y * reach;
  vec2 pixel = a + dir * along + normal * across;
  gl_Position = vec4(pixel / size * 2.0 - 1.0, 0.0, 1.0);
  local = vec2(along, across);
  span = segment;
  energy = screen.beam.y * p1.z * exp(-screen.decay.rgb * p1.w);
}
`;

export const BEAM_FRAGMENT = /* glsl */ `${HEADER}${SCREEN}${TRACE}
in vec2 local;
flat in float span;
flat in vec3 energy;
out vec4 color;

// Abramowitz and Stegun 7.1.27, |error| <= 5e-4.
float erf(float x) {
  float a = abs(x);
  float t = 1.0 + (0.278393 + (0.230389 + (0.000972 + 0.078108 * a) * a) * a) * a;
  t = t * t;
  return sign(x) * (1.0 - 1.0 / (t * t));
}

void main() {
  float sigma = screen.beam.x;
  float x = local.x;
  float y = local.y;
  float density = 1.0 / (2.5066283 * sigma);
  float across = exp(-(y * y) / (2.0 * sigma * sigma)) * density;
  float along = exp(-(x * x) / (2.0 * sigma * sigma)) * density;
  if (span >= 1e-3) {
    float k = 1.0 / (1.4142135 * sigma);
    along = (erf(x * k) - erf((x - span) * k)) / (2.0 * span);
  }
  color = vec4(traceLight() * energy * across * along, 0.0);
}
`;

/*
 * The SDR composites of ./wgsl.ts, each ground's tail after the hot core.
 * WebGL2 has no HDR canvas here, so there are no HDR variants.
 */
const compositeFragment = (tail: string) => /* glsl */ `${HEADER}${SCREEN}
uniform sampler2D history;
in vec2 uv;
out vec4 color;

vec3 sampleHistory(vec2 offset) {
  return texture(history, uv + vec2(offset.x, -offset.y)).rgb;
}

void main() {
  vec2 texel = screen.texel.xy * screen.core.a;
  vec2 outerTexel = texel * 2.0;
  vec3 center = sampleHistory(vec2(0.0, 0.0));
  vec3 blur =
      center * 0.2 +
      sampleHistory(vec2(texel.x, 0.0)) * 0.13 +
      sampleHistory(vec2(-texel.x, 0.0)) * 0.13 +
      sampleHistory(vec2(0.0, texel.y)) * 0.13 +
      sampleHistory(vec2(0.0, -texel.y)) * 0.13 +
      sampleHistory(vec2(texel.x, texel.y)) * 0.055 +
      sampleHistory(vec2(-texel.x, texel.y)) * 0.055 +
      sampleHistory(vec2(texel.x, -texel.y)) * 0.055 +
      sampleHistory(vec2(-texel.x, -texel.y)) * 0.055;
  vec3 halo =
      sampleHistory(vec2(outerTexel.x, 0.0)) * 0.03 +
      sampleHistory(vec2(-outerTexel.x, 0.0)) * 0.03 +
      sampleHistory(vec2(0.0, outerTexel.y)) * 0.03 +
      sampleHistory(vec2(0.0, -outerTexel.y)) * 0.03 +
      sampleHistory(vec2(outerTexel.x, outerTexel.y)) * 0.016 +
      sampleHistory(vec2(-outerTexel.x, outerTexel.y)) * 0.016 +
      sampleHistory(vec2(outerTexel.x, -outerTexel.y)) * 0.016 +
      sampleHistory(vec2(-outerTexel.x, -outerTexel.y)) * 0.016;
  vec3 glow = max((blur + halo * 0.8) * (0.38 + screen.floorMix.a * 0.3) - center * 0.18, vec3(0.0));
  vec3 lit = center * (1.0 + screen.texel.z * 0.28) + glow;
  vec3 mapped = vec3(1.0) - exp(-lit * screen.toneK.rgb);
  vec3 tinted = mapped * screen.tint.rgb;
  float highlight = smoothstep(0.52, 1.4, max(max(lit.r, lit.g), lit.b));
  vec3 hotCore = mix(tinted, screen.core.rgb, highlight * 0.38);
${tail}
}
`;

const COMPOSITE_FRAGMENT =
  compositeFragment(/* glsl */ `  vec3 floorLight = screen.floorMix.rgb * screen.tint.a;
  color = vec4(max(hotCore, floorLight), 1.0);`);

/** The composite for each ground. The light tail's constants and their reason are in ./wgsl.ts. */
export const COMPOSITE_FRAGMENTS = {
  screen: COMPOSITE_FRAGMENT,
  dark: compositeFragment(
    "  color = vec4(hotCore, max(max(hotCore.r, hotCore.g), hotCore.b));"
  ),
  light: compositeFragment(/* glsl */ `  const float GAIN = 0.15;
  const float CEILING = 0.7;
  float energy = max(max(lit.r, lit.g), lit.b);
  float alpha = CEILING * (1.0 - exp(-energy * GAIN));
  vec3 hue = lit / max(energy, 1e-6);
  vec3 encoded = mix(1.055 * pow(hue, vec3(1.0 / 2.4)) - 0.055, hue * 12.92, lessThanEqual(hue, vec3(0.0031308)));
  color = vec4(encoded * alpha, alpha);`),
} as const satisfies Record<Ground, string>;

/** Draws the old history into a resized history texture, so the afterglow survives a resize. */
export const RESAMPLE_FRAGMENT = /* glsl */ `${HEADER}
uniform sampler2D source;
in vec2 uv;
out vec4 color;

void main() {
  color = texture(source, uv);
}
`;
