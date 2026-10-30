import { toHz, type ToneSource } from "@/lib/audio";
import {
  LOOK_LIMITS,
  MAX_POINTS,
  MAX_STRIPS,
  type FrameWriter,
  type PhosphorLook,
  type TraceIndex,
} from "@/lib/phosphor";

import {
  yHzOf,
  type Form,
  type FormSettings,
  type WaveformConfig,
} from "./settings";

/** What the page sits on, from the theme. */
export type Theme = "dark" | "light";

/**
 * The config a form draws. A form whose figure is "shared" draws the config
 * itself. A form with its own ratio draws a simplified version of it, a
 * closed figure that holds still:
 *
 * - X's frequency, both waves, and both phases, with Y locked to the ratio.
 * - No detune. A few cents turns a closed figure through its whole family
 *   every second or two, and at 20 px the trail smears that into a solid
 *   square.
 * - The tones even under source "audio", in XY, with no drift, wander,
 *   rotation, spin, symmetry, or mirror.
 * - The longest trail, no bloom, and intensity 1. The bloom spreads in
 *   backing pixels, about 2.5 of them at Golden's 0.9, and the presets'
 *   intensity 2 widens the lit core, so either fills the gaps of a figure
 *   40 backing pixels across, the mark's at a device pixel ratio of 2.
 *
 * The color, screen, beam, the display's XY settings, and the form's own
 * settings stay the config's, so it reads as the same waveform and audio
 * still brightens and swells it.
 */
export function figureFor(config: WaveformConfig, form: Form): WaveformConfig {
  const { figure } = config.forms[form];

  if (figure === "shared") return config;

  const { tones } = config;

  return {
    ...config,
    source: "tones",
    tones: {
      ...tones,
      x: { ...tones.x, detuneCents: 0 },
      y: { ...tones.y, detuneCents: 0 },
      ratio: figure,
    },
    motion: {
      ...config.motion,
      drift: 0,
      wander: 0,
      rotation: 0,
      spin: 0,
      symmetry: 1,
      mirror: false,
    },
    // The same xy object, so the scope's XY display keeps its trace.
    display: { ...config.display, mode: "xy" },
    look: {
      ...config.look,
      persistence: LOOK_LIMITS.persistence.max,
      bloom: LOOK_LIMITS.bloom.min,
      intensity: 1,
    },
  };
}

/**
 * The tones at `seconds` of figure time. Drift and wander move Y's
 * frequency only, never its phase, so the preview feed keeps every channel
 * continuous and builds no new wave table.
 */
export function toneSourceAt(
  config: WaveformConfig,
  seconds: number
): ToneSource {
  const { tones, motion } = config;
  const base = yHzOf(tones);

  const swing =
    motion.wander * Math.sin(2 * Math.PI * motion.wanderRate * seconds);

  const y = Math.max(1, base * 2 ** (swing / 1200) + motion.drift);

  return {
    tones: {
      left: { ...tones.x, hz: toHz(tones.x.hz), amplitude: 1 },
      right: { ...tones.y, hz: toHz(y), amplitude: 1 },
    },
  };
}

/**
 * The audio's excitation, 0 to 1. Punch follows the level fast and falls
 * slowly. Brightness may rise fast but must fall slowly, so it cannot flash.
 */
export type Envelope = { readonly punch: number };

export const QUIET: Envelope = { punch: 0 };

/** Time constants in seconds. Punch's release is long enough that 2 to 15 Hz strikes and 3 to 30 Hz level square waves pass the flash analysis at full reactivity. */
const PUNCH = { attack: 0.015, release: 1.5 } as const;

/** What a strike adds: punch rises to at least this. */
const STRIKE = 0.9;

function follow(
  value: number,
  target: number,
  dt: number,
  times: { readonly attack: number; readonly release: number }
) {
  const tau = target > value ? times.attack : times.release;

  return target + (value - target) * Math.exp(-dt / tau);
}

/** The envelope `dt` seconds on, following `level`, 0 to 1. */
export function stepEnvelope(
  envelope: Envelope,
  level: number,
  dt: number
): Envelope {
  return { punch: follow(envelope.punch, level, dt, PUNCH) };
}

export function strike(envelope: Envelope): Envelope {
  return { punch: Math.max(envelope.punch, STRIKE) };
}

/** A box in CSS pixels, as getBoundingClientRect() reports it. */
export type Box = {
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
};

/** Where a form's figure sits in its canvas, in the canvas's own units. */
export type Framing = {
  readonly width: number;
  readonly height: number;
  /** The figure's center. */
  readonly cx: number;
  readonly cy: number;
  /** The side of the square that frames the figure at size 1. */
  readonly side: number;
};

/**
 * Without an anchor the figure is centered and framed by the canvas's
 * shorter side. With one, it is centered on the anchor's x and the canvas's
 * vertical middle, and framed by the anchor's width, never wider than the
 * canvas's shorter side.
 */
export function framingOf(canvas: Box, anchor: Box | null): Framing {
  const shorter = Math.min(canvas.width, canvas.height);

  if (!anchor)
    return {
      width: canvas.width,
      height: canvas.height,
      cx: canvas.width / 2,
      cy: canvas.height / 2,
      side: shorter,
    };

  return {
    width: canvas.width,
    height: canvas.height,
    cx: anchor.left + anchor.width / 2 - canvas.left,
    cy: canvas.height / 2,
    side: Math.min(anchor.width, shorter),
  };
}

/** Whether two framings place a figure the same way. */
export function sameFraming(a: Framing, b: Framing): boolean {
  return (
    a.width === b.width &&
    a.height === b.height &&
    a.cx === b.cx &&
    a.cy === b.cy &&
    a.side === b.side
  );
}

/**
 * What the punch does to a form, at full reactivity and a punch of 1: the
 * figure grows by a quarter and its bloom rises by 1.5, up to the bloom's
 * limit. A strike, a punch of 0.9, at the stage's default reactivity of 0.4
 * grows it by 9% and lifts its bloom by 0.54. Both follow the punch, so they
 * rise in about 15 ms and fall over 1.5 s.
 */
const KICK = 0.25;

const FLARE = 1.5;

export function reactionOf(reactivity: number, punch: number) {
  const amount = reactivity * punch;

  return { scale: 1 + KICK * amount, bloom: FLARE * amount };
}

/**
 * The side of the square a form's figure fills: the framing's side times
 * the size and the kick. The glow stays inside the canvas's shorter side,
 * so it never spans the page; the other forms zoom in past their frame.
 */
export function figureSide(
  form: Form,
  framing: Framing,
  scale: number
): number {
  const side = framing.side * scale;

  return form === "glow" ? Math.min(side, framing.width, framing.height) : side;
}

/** Symmetry 8 with mirror. */
const MAX_COPIES = 16;

/**
 * One affine map per copy, from the scope's clip space to the canvas's:
 * x' = m0 x + m1 y + m4, y' = m2 x + m3 y + m5. Reused every frame.
 */
export type Pose = { copies: number; readonly m: Float64Array };

export function createPose(): Pose {
  return { copies: 1, m: new Float64Array(6 * MAX_COPIES) };
}

/** Copies a figure draws: symmetry, doubled by mirror. */
export function copiesOf(config: WaveformConfig): number {
  return config.motion.symmetry * (config.motion.mirror ? 2 : 1);
}

/**
 * Fills `pose` for a figure of `side` at the framing's center, turned by
 * `turns`, in `symmetry` copies a 1 / symmetry turn apart, each with a
 * reflected twin when `mirror` is on. The scale corrects the canvas's
 * aspect, so the figure stays square on a wide glow.
 */
export function poseInto(
  pose: Pose,
  framing: Framing,
  side: number,
  turns: number,
  symmetry: number,
  mirror: boolean
): void {
  const sx = side / framing.width;
  const sy = side / framing.height;
  const ex = (2 * framing.cx) / framing.width - 1;
  const ey = 1 - (2 * framing.cy) / framing.height;
  const flips = mirror ? 2 : 1;

  pose.copies = Math.min(MAX_COPIES, symmetry * flips);

  for (let copy = 0; copy < pose.copies; copy += 1) {
    const angle = 2 * Math.PI * (turns + Math.floor(copy / flips) / symmetry);
    const flip = copy % flips === 1 ? -1 : 1;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const at = copy * 6;

    pose.m[at] = sx * cos * flip;
    pose.m[at + 1] = -sx * sin;
    pose.m[at + 2] = sy * sin * flip;
    pose.m[at + 3] = sy * cos;
    pose.m[at + 4] = ex;
    pose.m[at + 5] = ey;
  }
}

const OP_DURATION = 0;

const OP_STRIP = 1;

const OP_POINT = 2;

/** Room for every point a frame holds, a duration before each, and the strips. */
const MAX_OPS = 2 * MAX_POINTS + 256;

/**
 * Captures what the scope writes in one frame, in order, so the form can
 * replay it once per copy through the pose. Writes past capacity are
 * dropped.
 *
 * The copies share the screen's MAX_STRIPS and MAX_POINTS, so the screen
 * drops nothing and every copy draws the same figure. A frame with more
 * strips than one copy's share, as both YT channels at a fast timebase in
 * many copies have, replays its newest strips that fit. A frame with more
 * points than one copy's share replays every stride-th point of each strip
 * and its last, so every copy draws the whole figure at a coarser step. A
 * kept point keeps its own beam time, so the line beam keeps its brightness
 * and the gaussian beam dims by the stride.
 */
export type Recorder = {
  readonly writer: FrameWriter;
  reset(): void;
  replay(out: FrameWriter, pose: Pose): void;
};

export function createRecorder(): Recorder {
  const ops = new Uint8Array(MAX_OPS);
  const a = new Float64Array(MAX_OPS);
  const b = new Float64Array(MAX_OPS);
  let count = 0;
  let opened = false;

  const push = (op: number, first: number, second: number) => {
    if (count === MAX_OPS) return;
    ops[count] = op;
    a[count] = first;
    b[count] = second;
    count += 1;
  };

  const endsStrip = (index: number) => {
    let next = index + 1;

    while (next < count && ops[next] === OP_DURATION) next += 1;

    return next === count || ops[next] === OP_STRIP;
  };

  const strip = (trace: TraceIndex) => {
    opened = true;
    push(OP_STRIP, trace, 0);
  };

  return {
    writer: {
      pointDuration: (seconds) => push(OP_DURATION, seconds, 0),
      strip,
      point(x, y) {
        // The screen starts a strip for a point written before any strip,
        // and each copy needs its own, so a copy never joins the one before.
        if (!opened) strip(0);
        push(OP_POINT, x, y);
      },
    },
    reset() {
      count = 0;
      opened = false;
    },
    replay(out, pose) {
      // Walk back to the oldest of the newest strips that fit one copy's
      // share, counting what they hold.
      const limit = Math.floor(MAX_STRIPS / pose.copies);
      let first = 0;
      let strips = 0;
      let points = 0;

      for (let index = count - 1; index >= 0; index -= 1) {
        if (ops[index] === OP_POINT) points += 1;
        else if (ops[index] === OP_STRIP) strips += 1;

        if (strips === limit) {
          first = index;
          break;
        }
      }

      // The beam time set before the first kept strip still holds there.
      const lead = ops.subarray(0, first).lastIndexOf(OP_DURATION);

      // A strip of n points keeps fewer than n / stride + 2 of them, so the
      // share leaves 2 for each strip.
      const share = Math.floor(MAX_POINTS / pose.copies) - 2 * strips;
      const stride = Math.max(1, Math.ceil(points / share));

      for (let copy = 0; copy < pose.copies; copy += 1) {
        const at = copy * 6;
        const [m0, m1, m2, m3, m4, m5] = pose.m.subarray(at, at + 6);
        let step = 0;

        if (lead >= 0) out.pointDuration(a[lead]);

        for (let index = first; index < count; index += 1) {
          const x = a[index];
          const y = b[index];

          switch (ops[index]) {
            case OP_DURATION:
              out.pointDuration(x);
              break;

            case OP_STRIP:
              step = 0;
              // SAFETY: only the writer's strip(trace) records this op, with a TraceIndex.
              out.strip(x as TraceIndex);
              break;

            default:
              if (step % stride === 0 || endsStrip(index))
                out.point(m0 * x + m1 * y + m4, m2 * x + m3 * y + m5);
              step += 1;
          }
        }
      }
    },
  };
}

export const ARRIVE_MS = 1600;

export const DEPART_MS = 2600;

/** A still form draws this much figure time, then holds. */
export const STILL_MS = 1000;

/**
 * Form changes ease strength, depth, and size over this long: Kevelle's
 * large duration, about as long as the view transition that moves the
 * roaming canvas between slots, so the figure settles as the morph lands.
 */
export const MOVE_MS = 280;

/**
 * Whether a form is showing. An arriving form turns its beam on and eases
 * in; a departing one turns its beam off, so its afterglow fades, and eases
 * out. Both start from the level they interrupt, so a toggle never pops.
 * Once a departure reaches 0 the form is absent: its screen is cleared and
 * it does no GPU work.
 */
export type Presence =
  | { readonly kind: "arriving"; readonly since: number; readonly from: number }
  | { readonly kind: "present" }
  | {
      readonly kind: "departing";
      readonly since: number;
      readonly from: number;
    }
  | { readonly kind: "absent" };

const smooth = (t: number) => {
  const clamped = Math.min(1, Math.max(0, t));

  return clamped * clamped * (3 - 2 * clamped);
};

/** The presence at `now`, after a departure or an arrival completes. */
export function settlePresence(presence: Presence, now: number): Presence {
  if (presence.kind === "arriving" && now - presence.since >= ARRIVE_MS)
    return { kind: "present" };

  if (presence.kind === "departing" && now - presence.since >= DEPART_MS)
    return { kind: "absent" };

  return presence;
}

/** 0 to 1, continuous through any sequence of toggles. */
export function presenceLevel(presence: Presence, now: number): number {
  switch (presence.kind) {
    case "arriving":
      return (
        presence.from +
        (1 - presence.from) * smooth((now - presence.since) / ARRIVE_MS)
      );

    case "departing":
      return presence.from * (1 - smooth((now - presence.since) / DEPART_MS));

    case "present":
      return 1;

    case "absent":
      return 0;
  }
}

/** The presence after the form is asked to be present or not at `now`. The same object when nothing changes. */
export function togglePresence(
  presence: Presence,
  present: boolean,
  now: number
): Presence {
  const showing = presence.kind === "arriving" || presence.kind === "present";

  if (showing === present) return presence;

  const from = presenceLevel(presence, now);

  return present
    ? { kind: "arriving", since: now, from }
    : { kind: "departing", since: now, from };
}

/**
 * A still form's motion. It settles by drawing STILL_MS of figure time from
 * its own clock, then holds. A config, form, anchor, or theme change, a new
 * framing, a recovered device, or an arrival starts it settling again. Audio
 * and strikes never do.
 */
export type Stillness =
  | { readonly kind: "live" }
  | { readonly kind: "settling"; readonly start: number | null }
  | { readonly kind: "held" };

/** The figure time a settling form has reached at `now`, in ms, up to STILL_MS. */
export function settledMs(stillness: Stillness, now: number): number {
  if (stillness.kind === "held") return STILL_MS;

  if (stillness.kind === "live" || stillness.start === null) return 0;

  return Math.min(STILL_MS, Math.max(0, now - stillness.start));
}

/**
 * A form's opacity: its strength times its presence, brightened by up to
 * half again by the punch at full reactivity, and never above 1.
 */
export function opacityOf(
  strength: number,
  presence: number,
  reactivity: number,
  punch: number
): number {
  return Math.min(1, strength * presence * (1 + 0.5 * reactivity * punch));
}

/** The form settings between `from` and `to`, `t` of the way, eased. The figure changes at once. */
export function easeForm(
  from: FormSettings,
  to: FormSettings,
  t: number
): FormSettings {
  const k = smooth(t);
  const mix = (a: number, b: number) => a + (b - a) * k;

  return {
    figure: to.figure,
    size: mix(from.size, to.size),
    strength: mix(from.strength, to.strength),
    depth: mix(from.depth, to.depth),
    reactivity: mix(from.reactivity, to.reactivity),
  };
}

/**
 * The shortest trail a figure of `copies` draws with. A short trail lets
 * each pixel follow the beam frame by frame, and many copies light most of
 * the screen, so together they flicker past WCAG 2.3.1's general flash
 * limit. Up to four copies keep the Oscilloscope's range.
 */
function shortestTrail(copies: number): number {
  return LOOK_LIMITS.persistence.min + 8 * Math.max(0, copies - 4);
}

/** The glow draws at half resolution: it is large and blurred, so the backing store costs a quarter. */
const RESOLUTION = {
  stage: 1,
  glow: 0.5,
  screen: 1,
  mark: 1,
} as const satisfies { readonly [F in Form]: number };

/**
 * The phosphor look one form draws with, from the figure it draws: the
 * config's look, with the longest trail and no bloom for a figure of its
 * own. The canvas is transparent over either theme. "auto" color is astral
 * on a light page. On a dark one it is the screen's own green on P31 and
 * the phosphor token on any other screen, since a pick of either color
 * moves the screen to Neutral, whose own emission is white.
 */
export function lookFor(
  config: WaveformConfig,
  form: Form,
  theme: Theme
): PhosphorLook {
  const drawn = figureFor(config, form);
  const { look } = drawn;

  const auto =
    theme === "light"
      ? "astral"
      : look.screen === "p31"
        ? "screen"
        : "phosphor";

  return {
    screen: look.screen,
    beam: look.beam,
    persistence: Math.max(look.persistence, shortestTrail(copiesOf(drawn))),
    bloom: look.bloom,
    background: 0,
    focus: look.focus,
    intensity: look.intensity,
    traces: [look.color === "auto" ? auto : look.color, look.color2],
    hdr: look.hdr,
    ground: theme,
    resolution: RESOLUTION[form],
  };
}
