import {
  createFeedCursor,
  createPreviewFeed,
  createSampleWindow,
  type FeedCursor,
  type SampleFeed,
} from "@/lib/audio";
import {
  LOOK_LIMITS,
  MAX_POINTS,
  createPhosphorScreen,
  type PhosphorLook,
  type PhosphorScreen,
  type Producer,
  type ScreenStatus,
} from "@/lib/phosphor";
import {
  createScopeProducer,
  type DisplaySettings,
  type ScopeProducer,
} from "@/lib/scope";

import { drawnAt, type Play } from "./keys";
import {
  MOVE_MS,
  QUIET,
  STILL_MS,
  STILL_QUIET_MS,
  copiesOf,
  createPose,
  createRecorder,
  drawsOwnTones,
  easeForm,
  figureFor,
  figureSide,
  framingOf,
  lookFor,
  opacityOf,
  poseInto,
  presenceLevel,
  reactionOf,
  sameFraming,
  settlePresence,
  settledMs,
  stepEnvelope,
  strike,
  togglePresence,
  toneSourceAt,
  type Box,
  type Envelope,
  type Framing,
  type Presence,
  type Stillness,
  type Theme,
} from "./figure";
import {
  yHzOf,
  type Form,
  type FormSettings,
  type WaveformConfig,
} from "./settings";

/** What a Waveform asks of its form. */
export type FormState = {
  readonly form: Form;
  readonly anchor: Element | null;
  readonly present: boolean;
  /** Forces the still. The engine also stills every form under prefers-reduced-motion. */
  readonly still: boolean;
  /** Keyboard focus: the bloom lifts by LIT_BLOOM, eased over MOVE_MS, at once when still, and nothing settles again. Default false. */
  readonly lit?: boolean;
};

/**
 * What a form's runtime needs from its canvas. attach() builds one over a
 * phosphor screen; a test can build its own and call produce itself.
 */
export type FormSurface = {
  setLook(look: PhosphorLook): void;
  clear(): void;
  /** The canvas's opacity and blur in CSS px. */
  paint(opacity: number, depth: number): void;
  /** The canvas's box and the anchor's, in CSS pixels. */
  measure(anchor: Element): { readonly canvas: Box; readonly anchor: Box };
};

export type MountedForm = {
  readonly produce: Producer;
  set(state: FormState): void;
  /**
   * Follows the screen's status. A recovered device starts with an empty
   * history, and a pause stops the settling second short, so after either a
   * still form settles again.
   */
  status(status: ScreenStatus): void;
  detach(): void;
};

export type AttachedForm = {
  set(state: FormState): void;
  destroy(): void;
};

/** A box the roaming canvas can show in. */
export type Slot = {
  /** Takes the canvas into the box. */
  hold(): void;
  /** Gives up the canvas, before the next holder takes it. */
  letGo(): void;
};

/** A slot's claim on the roaming canvas, from its mount to its release. */
export type Claim = {
  /** The slot's own state. The canvas draws it while the slot holds it. */
  set(state: FormState): void;
  release(): void;
};

/**
 * The roaming canvas's runtime over any surface, without a screen: one form
 * that shows in the newest slot. claim() runs one over the provider's
 * canvas.
 */
export type Roaming = {
  readonly produce: Producer;
  /** Puts `slot` on top. It holds the canvas until a newer slot claims it or it releases. */
  claim(slot: Slot, state: FormState): Claim;
  status(status: ScreenStatus): void;
  detach(): void;
};

export type WaveformEngine = {
  /**
   * Idempotent: an unchanged config, feed, and play change nothing. A
   * config change with a play is that play's commit and never restarts the
   * tones. Any other config change restarts them by restartsTones, judged
   * against what the last frame drew. The provider is the only caller that
   * sets a play.
   */
  set(next: {
    readonly config: WaveformConfig;
    readonly audio: SampleFeed | null;
    readonly play: Play | null;
  }): void;
  strike(): void;
  /** A press's touch: the punch rises to at least `punch`, 0 to 0.9, as a strike raises it to 0.9. */
  touch(punch: number): void;
  /** Draws a form on `canvas` until destroy(). The glow and the mark draw this way. */
  attach(canvas: HTMLCanvasElement, state: FormState): AttachedForm;
  /**
   * Shows the engine's one roaming canvas in `box` while this is the newest
   * claim, and hands it back to the newest claim before it on release. Call
   * both from layout effects, so a slot that unmounts and one that mounts in
   * the same commit pass the canvas on before the browser paints, or before
   * a view transition captures the new state.
   */
  claim(box: HTMLElement, state: FormState): Claim;
  /** Frees the roaming canvas. A later claim starts a new one. */
  dispose(): void;
  /** A form's runtime over any surface, without a screen. attach() uses it. */
  mount(surface: FormSurface, state: FormState): MountedForm;
  /** The roaming canvas's runtime over any surface. claim() uses it. */
  roam(surface: FormSurface, state: FormState): Roaming;
};

/** Everything one animation frame shares across forms. */
type Moment = {
  readonly now: number;
  readonly envelope: Envelope;
  /** What live forms of the shared figure draw: the audio while it carries signal under source "audio", the tones otherwise. */
  readonly feed: SampleFeed;
  /** The config live forms of the shared figure draw: the play's, or the config. */
  readonly drawn: WaveformConfig;
  /** The shared figure's spin so far, in turns. */
  readonly turns: number;
};

/** Keyboard focus lifts a form's bloom by this, so the figure itself shows it. */
const LIT_BLOOM = 0.6;

/** The level reads at most this many recent frames per animation frame. */
const LEVEL_FRAMES = 4096;

/** A peak above this counts as signal. */
const SIGNAL_FLOOR = 1e-3;

/** Audio keeps the figure this long after its last signal, so a gap between songs doesn't flip it to the tones and back. */
const SIGNAL_HOLD_MS = 500;

/** A feed that delivers no new frames this long reads as silent. */
const STALL_MS = 100;

/** Points the XY display adds per frame to join each copy's runs. */
const JOIN_POINTS = 4;

/** The engine's own reader of the audio, for its level. */
type LevelReader = { readonly feed: SampleFeed; readonly cursor: FeedCursor };

/** A form change's ease from the values it showed. */
type Move = { readonly from: FormSettings; readonly since: number };

/** What the engine tells each mounted form. */
type FormRuntime = {
  configured(): void;
  restyled(): void;
  struck(): void;
};

/** Whether two figures draw Y at one ratio to X, past rounding. */
const sameRatio = (a: WaveformConfig, b: WaveformConfig) =>
  Math.abs(yHzOf(a.tones) / a.tones.x.hz - yHzOf(b.tones) / b.tones.x.hz) <
  1e-9;

const singleSweep = (config: WaveformConfig) =>
  config.display.mode === "yt" && config.display.yt.trigger.mode === "single";

/**
 * The share of a form's side that keeps every copy of its figure inside its
 * square. The scope's figure fills the square edge to edge, and a unit
 * square turned by θ reaches |cos θ| + |sin θ| along either axis, so the
 * side shrinks by the widest reach among the copies, each 1 / symmetry of a
 * turn past `turns`. Mirrored twins reach as far as their copies. An
 * unturned figure keeps its size.
 */
function fitOf(turns: number, symmetry: number): number {
  let reach = 1;

  for (let copy = 0; copy < symmetry; copy += 1) {
    const angle = 2 * Math.PI * (turns + copy / symmetry);

    reach = Math.max(
      reach,
      Math.abs(Math.cos(angle)) + Math.abs(Math.sin(angle))
    );
  }

  return 1 / reach;
}

/**
 * Whether a change starts the oscillators again: anything in the tones but a
 * frequency, or the drift or wander that move Y's frequency, since both build
 * up phase the preview feed keeps across a retune.
 */
function restartsTones(
  previous: WaveformConfig,
  next: WaveformConfig
): boolean {
  const before = previous.tones;
  const after = next.tones;

  return (
    before.ratio !== after.ratio ||
    (["x", "y"] as const).some(
      (channel) =>
        before[channel].wave !== after[channel].wave ||
        before[channel].detuneCents !== after[channel].detuneCents ||
        before[channel].phase !== after[channel].phase
    ) ||
    previous.motion.drift !== next.motion.drift ||
    previous.motion.wander !== next.motion.wander ||
    previous.motion.wanderRate !== next.motion.wanderRate
  );
}

export function createWaveform(init: {
  readonly config: WaveformConfig;
  readonly audio: SampleFeed | null;
  /** The roaming canvas's view-transition-name, or null for none. The glow takes it with "-glow". */
  readonly viewTransitionName?: string | null;
}): WaveformEngine {
  let config = init.config;
  let audio = init.audio;
  let play: Play | null = null;
  let theme: Theme = "dark";
  let reducedMotion = false;
  let envelope = QUIET;
  let moment: Moment | null = null;
  let lastNow: number | null = null;
  /** The shared figure's spin and its wander's cycles so far. */
  let turns = 0;
  let wandered = 0;
  /** The cut the preview last made, so each play's cut happens once. */
  let cut: number | null = null;
  /** Set when a config from outside starts the tones again, until the next frame. */
  let restarted = false;
  let tones = toneSourceAt(config, 0);
  const startTones = () => createPreviewFeed(() => tones);
  let preview = startTones();
  let level: LevelReader | null = null;
  const levelWindow = createSampleWindow(LEVEL_FRAMES);
  let lastLevel = 0;
  let framesAt = -Infinity;
  let signalAt = -Infinity;
  const forms = new Set<FormRuntime>();
  let stopWatching: (() => void) | null = null;

  /** The roaming canvas, from the first claim until dispose(). */
  let roaming: {
    readonly canvas: HTMLCanvasElement;
    readonly runtime: Roaming;
    readonly stop: () => void;
  } | null = null;

  /** Whether a slot holds the roaming canvas. */
  let held = false;

  /** The canvases attached for marks and for glows, oldest first. */
  const marks: HTMLCanvasElement[] = [];

  const glows: HTMLCanvasElement[] = [];

  /** The audio's level at `now`, 0 to 1: its RMS, scaled so a full-scale sine reads 1. */
  function audioLevel(now: number): number {
    if (!audio) {
      level = null;

      return 0;
    }

    if (level?.feed !== audio)
      level = { feed: audio, cursor: createFeedCursor(audio) };

    let sum = 0;
    let frames = 0;
    let peak = 0;

    level.cursor.advance(
      audio.heardAt(now),
      levelWindow,
      (run) => {
        const { left, right, start, channels } = run.window;

        for (let index = run.from - start; index < run.to - start; index += 1) {
          const l = left[index];
          const r = channels === 2 ? right[index] : l;
          sum += (l * l + r * r) / 2;
          peak = Math.max(peak, Math.abs(l), Math.abs(r));
        }

        frames += run.to - run.from;
      },
      { budget: LEVEL_FRAMES }
    );

    if (peak > SIGNAL_FLOOR) signalAt = now;

    if (frames > 0) {
      framesAt = now;
      lastLevel = Math.min(1, Math.sqrt(sum / frames) * Math.SQRT2);
    } else if (now - framesAt > STALL_MS) lastLevel = 0;

    return lastLevel;
  }

  function momentAt(now: number): Moment {
    if (moment?.now === now) return moment;

    const cutAt = play?.cutAt ?? null;
    const cutting = cutAt !== null && now >= cutAt && cut !== cutAt;

    const anchored = lastNow === null || restarted || cutting;
    const dt = lastNow === null ? 0 : Math.max(0, (now - lastNow) / 1000);
    lastNow = now;
    restarted = false;

    const drawn = play ? drawnAt(play, now) : config;
    const { spin, wanderRate } = drawn.motion;

    // The first frame, and each frame the tones start together again, start
    // where the page's clock stands, as an absolute clock would draw. So a
    // constant rate draws what it always has, and a figure that comes home
    // after a spin lands on its own turn.
    turns = anchored ? (spin * now) / 1000 : turns + spin * dt;
    wandered = anchored
      ? (wanderRate * now) / 1000
      : wandered + wanderRate * dt;
    tones = toneSourceAt(drawn, wandered / wanderRate);

    if (cutting) {
      cut = cutAt;
      preview = startTones();
    }

    envelope = stepEnvelope(envelope, audioLevel(now), dt);

    const live =
      drawn.source === "audio" && audio && now - signalAt < SIGNAL_HOLD_MS
        ? audio
        : null;

    moment = { now, envelope, feed: live ?? preview, drawn, turns };

    return moment;
  }

  function mount(surface: FormSurface, initial: FormState): MountedForm {
    let state = initial;
    let presence: Presence = { kind: "absent" };
    let stillness: Stillness = { kind: "live" };
    let cleared = false;
    let moved = false;
    let move: Move | null = null;
    let shown = config.forms[state.form];
    let stillFeed: SampleFeed | null = null;
    /** The framing of the last frame the form measured, or null before the first. */
    let framed: Framing | null = null;
    /** Set when the device starts recovering, until the screen next runs. Offscreen or hidden, the screen pauses in between. */
    let interrupted = false;
    const pose = createPose();
    const recorder = createRecorder();
    /** The config this form follows: the engine's while still, what the play draws while live. */
    let source = config;
    /** The config this form draws: its source, or its own figure of it. */
    let drawn = config;
    let ownTones = tones;
    /** The preview of the form's own figure, or null while it draws the shared one. */
    let own: SampleFeed | null = null;
    /** The focus lift, 0 to 1. */
    let lift = 0;
    /** Set by a config change, until the form's next frame stamps it in `stirredAt`. */
    let stirred = false;
    /** The first frame after the latest config a still form hasn't followed yet, or null once it follows the config. */
    let stirredAt: number | null = null;

    /** Follows the source and the form to the figure this form draws. */
    function redraw() {
      const next = figureFor(source, state.form);

      // A new ratio starts both oscillators together again, as the engine's
      // own preview does, so an X sweep keeps the phase and a new fraction
      // closes.
      if (!drawsOwnTones(source, state.form)) own = null;
      else if (!own || !sameRatio(next, drawn))
        own = createPreviewFeed(() => ownTones);

      drawn = next;
      ownTones = toneSourceAt(next, 0);
    }

    redraw();

    /** The waves and phases the producer last read, and the display it read them through. */
    let table = drawn.tones;
    let display = drawn.display;
    let shownDisplay = display;

    /**
     * The display the producer reads. A new wave or phase between frames
     * hands XY a new xy object, which drops its join to the last frame's
     * final point, so a phase sweep never draws a chord across the figure.
     * YT keeps its object, so its sweep carries on.
     */
    function displayNow(): DisplaySettings {
      if (drawn.display !== display) {
        display = drawn.display;
        shownDisplay = display;
      }

      const { x, y } = drawn.tones;

      if (
        x.wave !== table.x.wave ||
        x.phase !== table.x.phase ||
        y.wave !== table.y.wave ||
        y.phase !== table.y.phase
      ) {
        table = drawn.tones;

        if (display.mode === "xy")
          shownDisplay = { ...display, xy: { ...display.xy } };
      }

      return shownDisplay;
    }

    const isStill = () => state.still || reducedMotion;

    /** Framed by the anchor in CSS pixels, or by the canvas's backing size without one. */
    function framingNow(width: number, height: number) {
      if (!state.anchor)
        return framingOf({ left: 0, top: 0, width, height }, null);

      const boxes = surface.measure(state.anchor);

      return framingOf(boxes.canvas, boxes.anchor);
    }

    /** The feed this form draws now. Null turns the beam off, so the afterglow fades. */
    function feedNow(): SampleFeed | null {
      if (isStill()) return stillFeed;

      if (presence.kind === "departing" || presence.kind === "absent")
        return null;

      return own ?? moment?.feed ?? preview;
    }

    // A fresh producer starts from the frame heard now. Reusing one that sat
    // out would draw its backlog, up to the budget, in one frame.
    const fresh = (): ScopeProducer =>
      createScopeProducer({
        getFeed: feedNow,
        settings: displayNow,
        frozen: () => false,
        onSingleDone: () => {},
        budget: () => Math.floor(MAX_POINTS / copiesOf(drawn)) - JOIN_POINTS,
      });

    let producer = fresh();

    /**
     * A private preview whose clock starts at this form's settle. Its tones
     * stand where they are at the end of the second, as the turn does, so
     * the samples don't depend on where frames fall, and every still form
     * draws and holds the same figure.
     */
    function settleFeed(): SampleFeed {
      const inner = createPreviewFeed(() =>
        toneSourceAt(drawn, STILL_MS / 1000)
      );

      return {
        ...inner,
        heardAt: (now) => inner.heardAt(settledMs(stillness, now)),
      };
    }

    const resettle = () => {
      if (isStill()) stillness = { kind: "settling", start: null };
    };

    /** The form's look, and the bloom the punch and the focus add to it now. */
    let look = lookFor(config, state.form, theme);
    let flare = 0;

    // The mark never flares: at 20 px, bloom fills its figure's gaps. The
    // punch still swells it.
    const flared = (): PhosphorLook =>
      flare > 0 && state.form !== "mark"
        ? {
            ...look,
            bloom: Math.min(LOOK_LIMITS.bloom.max, look.bloom + flare),
          }
        : look;

    const restyle = () => {
      look = lookFor(source, state.form, theme);
      surface.setLook(flared());
    };

    function follow(next: WaveformConfig) {
      if (next === source) return;
      source = next;
      redraw();
      restyle();
    }

    const runtime: FormRuntime = {
      // A live form follows what the shared figure draws on its next frame. A
      // still form waits for the configs to stop, in produce. A config with a
      // play is the play's own commit, which comes every frame while the
      // play moves, so only a config from outside re-arms a single sweep: a
      // fresh producer each frame would never draw one.
      configured() {
        stirred = true;

        if (play || isStill()) return;
        follow(config);

        if (singleSweep(drawn)) producer = fresh();
      },
      // A held still keeps its history, drawn in the old theme's color, so
      // it draws its second again.
      restyled() {
        restyle();
        resettle();
      },
      struck() {
        if (singleSweep(drawn) && !isStill()) producer = fresh();
      },
    };

    forms.add(runtime);

    const produce: Producer = (frame, out) => {
      const { now } = frame;
      const shared = momentAt(now);
      const still = isStill();

      if (stirred) stirredAt = now;
      stirred = false;

      // A still form keeps what it holds while configs keep coming, from a
      // drag, a held key, or the play of another provider, and settles once
      // on the last after STILL_QUIET_MS without one, so a gesture never
      // blanks it.
      if (!still) {
        follow(shared.drawn);
        stirredAt = null;
      } else if (stirredAt === null) follow(config);
      else if (now - stirredAt >= STILL_QUIET_MS) {
        follow(config);
        resettle();
        stirredAt = null;
      }

      const toggled = togglePresence(presence, state.present, now);

      if (toggled !== presence && toggled.kind === "arriving") {
        if (still) resettle();
        else producer = fresh();
      }

      // The mark shows its figure as soon as it draws, so a view
      // transition into it lands on the mark and not an empty box.
      presence =
        state.form === "mark" && toggled.kind === "arriving"
          ? { kind: "present" }
          : settlePresence(toggled, now);

      if (presence.kind === "absent") {
        if (!cleared) surface.clear();
        cleared = true;
        surface.paint(0, shown.depth);

        return "hold";
      }

      cleared = false;

      // A still form's history holds the figure where the last framing put
      // it, so a new framing, from the canvas's size or the anchor's box,
      // settles it again.
      const framing = framingNow(frame.width, frame.height);

      if (framed && !sameFraming(framed, framing)) resettle();
      framed = framing;

      if (!still && stillness.kind !== "live") {
        stillness = { kind: "live" };
        stillFeed = null;
        producer = fresh();
      }

      if (still && stillness.kind === "live")
        stillness = { kind: "settling", start: null };

      if (stillness.kind === "settling" && stillness.start === null) {
        stillness = { kind: "settling", start: now };
        stillFeed = settleFeed();
        producer = fresh();
        surface.clear();
      }

      if (moved) {
        move = { from: shown, since: now };
        moved = false;
      }

      // A still form takes its target pose at once, including one that turns
      // still partway through a move, so its settling second draws that pose.
      if (still) move = null;

      const target = source.forms[state.form];
      const t = move ? (now - move.since) / MOVE_MS : 1;

      shown = move ? easeForm(move.from, target, t) : target;

      if (t >= 1) move = null;

      const reactivity = still ? 0 : shown.reactivity;

      const opacity = opacityOf(
        shown.strength,
        presenceLevel(presence, now),
        reactivity,
        shared.envelope.punch
      );

      surface.paint(opacity, shown.depth);

      const lit = state.lit ? 1 : 0;
      const stride = (frame.dt * 1000) / MOVE_MS;

      lift = still
        ? lit
        : lift < lit
          ? Math.min(lit, lift + stride)
          : Math.max(lit, lift - stride);

      const lifted = LIT_BLOOM * lift * lift * (3 - 2 * lift);
      const reaction = reactionOf(reactivity, shared.envelope.punch);
      const bloom = Math.round((reaction.bloom + lifted) * 100) / 100;

      if (bloom !== flare) {
        flare = bloom;
        surface.setLook(flared());
      }

      if (stillness.kind === "held") return "hold";

      const scale = shown.size * reaction.scale;

      const { motion } = drawn;

      // A still form holds the turn its second ends on. A live one turns by
      // the shared spin, its own figure included.
      const turn =
        motion.rotation +
        (still ? (motion.spin * STILL_MS) / 1000 : shared.turns);

      poseInto(
        pose,
        framing,
        figureSide(state.form, framing, scale) * fitOf(turn, motion.symmetry),
        turn,
        motion.symmetry,
        motion.mirror
      );

      recorder.reset();
      const result = producer.produce(frame, recorder.writer);
      recorder.replay(out, pose);

      if (
        stillness.kind === "settling" &&
        settledMs(stillness, now) >= STILL_MS
      )
        stillness = { kind: "held" };

      return result;
    };

    return {
      produce,
      set(next) {
        const previous = state;
        state = next;

        if (
          next.form === previous.form &&
          next.anchor === previous.anchor &&
          next.still === previous.still
        )
          return;

        if (next.form !== previous.form) {
          redraw();
          restyle();
          moved = true;
        }

        resettle();
      },
      status(next) {
        if (
          next.kind === "recovering" ||
          (next.kind === "paused" && stillness.kind === "settling")
        )
          interrupted = true;
        else if (next.kind === "running" && interrupted) {
          interrupted = false;
          resettle();
        }
      },
      detach() {
        forms.delete(runtime);
      },
    };
  }

  function roam(surface: FormSurface, initial: FormState): Roaming {
    const form = mount(surface, initial);
    const claims: { readonly slot: Slot; state: FormState }[] = [];

    /** Moves the canvas to the newest claim, if `previous` no longer is. */
    function handOff(previous: (typeof claims)[number] | undefined) {
      const holder = claims.at(-1);

      if (holder === previous) return;
      previous?.slot.letGo();

      if (!holder) return;
      holder.slot.hold();
      form.set(holder.state);
    }

    return {
      produce: form.produce,
      status: form.status,
      detach: form.detach,
      claim(slot, state) {
        const claim = { slot, state };
        const previous = claims.at(-1);

        claims.push(claim);
        handOff(previous);

        return {
          set(next) {
            claim.state = next;

            if (claims.at(-1) === claim) form.set(next);
          },
          release() {
            const index = claims.indexOf(claim);

            if (index < 0) return;
            const previous = claims.at(-1);

            claims.splice(index, 1);
            handOff(previous);
          },
        };
      },
    };
  }

  /** A surface over `canvas` that paints the form's opacity and blur on it and reaches its screen. */
  function canvasSurface(
    canvas: HTMLCanvasElement,
    screen: () => PhosphorScreen
  ): FormSurface {
    let painted = { opacity: Number.NaN, depth: Number.NaN };
    canvas.style.opacity = "0";

    return {
      setLook: (look) => screen().setLook(look),
      clear: () => screen().clear(),
      paint(opacity, depth) {
        const next = {
          opacity: Math.round(opacity * 1000) / 1000,
          depth: Math.round(depth * 10) / 10,
        };

        if (next.opacity !== painted.opacity)
          canvas.style.opacity = String(next.opacity);

        if (next.depth !== painted.depth)
          canvas.style.filter = next.depth > 0 ? `blur(${next.depth}px)` : "";

        painted = next;
      },
      measure: (anchor) => ({
        canvas: canvas.getBoundingClientRect(),
        anchor: anchor.getBoundingClientRect(),
      }),
    };
  }

  /** Runs a form's runtime on a phosphor screen over `canvas`. The returned function stops it. */
  function show(
    canvas: HTMLCanvasElement,
    runtime: {
      readonly produce: Producer;
      status(status: ScreenStatus): void;
      detach(): void;
    },
    state: FormState
  ) {
    const screen = createPhosphorScreen(canvas, {
      look: lookFor(config, state.form, theme),
      produce: runtime.produce,
    });

    const unsubscribe = screen.subscribe(() =>
      runtime.status(screen.getStatus())
    );

    return {
      screen,
      stop() {
        unsubscribe();
        screen.destroy();
        runtime.detach();

        if (forms.size > 0) return;
        stopWatching?.();
        stopWatching = null;
      },
    };
  }

  /**
   * The one place view-transition-names change. The live roaming canvas
   * carries the engine's name while a slot holds it. Otherwise the newest
   * mark borrows it, so leaving the live figure for the mark morphs
   * one into the other. Each glow carries the name with "-glow". Under
   * reduced motion nothing carries a name, so nothing of the waveform pairs
   * or animates. Names come off before any goes on. A name another canvas
   * on the page already carries, such as a second provider's, is skipped
   * with a warning, since two elements with one name stop every view
   * transition on the page.
   */
  function rename() {
    const base = init.viewTransitionName;
    const wanted = new Map<HTMLCanvasElement, string>();

    if (base && !reducedMotion) {
      const live = roaming && held ? roaming.canvas : marks.at(-1);

      if (live) wanted.set(live, base);

      for (const glow of glows) wanted.set(glow, `${base}-glow`);
    }

    const named = (canvas: HTMLCanvasElement) =>
      canvas.style.getPropertyValue("view-transition-name");

    for (const canvas of [
      ...marks,
      ...glows,
      ...(roaming ? [roaming.canvas] : []),
    ])
      if (!wanted.has(canvas))
        canvas.style.removeProperty("view-transition-name");

    for (const [canvas, name] of wanted) {
      if (named(canvas) === name) continue;

      const taken = [...document.querySelectorAll("canvas")].some(
        (other) =>
          other !== canvas && other.isConnected && named(other) === name
      );

      if (taken) {
        console.warn(
          `[kevelle/waveform] Another canvas already carries view-transition-name "${name}". Give each WaveformProvider on a page its own viewTransitionName, or null.`
        );
        continue;
      }

      canvas.style.setProperty("view-transition-name", name);
    }
  }

  /** Follows next-themes' class on <html>, then the system scheme, and reduced motion. */
  function watch(): () => void {
    const html = document.documentElement;
    const darkScheme = matchMedia("(prefers-color-scheme: dark)");
    const reduce = matchMedia("(prefers-reduced-motion: reduce)");

    const read = () => {
      const next: Theme = html.classList.contains("dark")
        ? "dark"
        : html.classList.contains("light") || !darkScheme.matches
          ? "light"
          : "dark";

      if (reduce.matches !== reducedMotion) {
        reducedMotion = reduce.matches;
        rename();
      }

      if (next === theme) return;
      theme = next;

      for (const form of forms) form.restyled();
    };

    read();
    const observer = new MutationObserver(read);
    observer.observe(html, { attributes: true, attributeFilter: ["class"] });
    darkScheme.addEventListener("change", read);
    reduce.addEventListener("change", read);

    return () => {
      observer.disconnect();
      darkScheme.removeEventListener("change", read);
      reduce.removeEventListener("change", read);
    };
  }

  return {
    set(next) {
      audio = next.audio;

      if (next.config === config && next.play === play) return;

      const changed = next.config !== config;

      // A config from outside with a new ratio, wave, detune, phase, drift,
      // or wander starts both oscillators together again, as the
      // Oscilloscope replays its tones, so a closed figure draws its own
      // shape and not the phase the last figure left. A frequency retunes in
      // place. The forms' producers see a new feed and resync by themselves.
      // The play's own commits never restart: the figure already shows them.
      if (
        changed &&
        !next.play &&
        restartsTones(moment?.drawn ?? config, next.config)
      ) {
        preview = startTones();
        restarted = true;
      }

      config = next.config;
      play = next.play;

      if (changed) for (const form of forms) form.configured();
    },
    strike() {
      envelope = strike(envelope);

      for (const form of forms) form.struck();
    },
    touch(punch) {
      envelope = { punch: Math.max(envelope.punch, punch) };

      for (const form of forms) form.struck();
    },
    mount,
    roam,
    attach(canvas, state) {
      stopWatching ??= watch();
      const own = state.form === "mark" ? marks : glows;

      own.push(canvas);
      rename();

      const mounted = mount(
        canvasSurface(canvas, () => shown.screen),
        state
      );

      const shown = show(canvas, mounted, state);

      return {
        set: mounted.set,
        destroy() {
          shown.stop();
          // React runs this layout cleanup before it removes the canvas, so
          // rename() would still find the name on it and skip the next holder.
          canvas.style.removeProperty("view-transition-name");
          own.splice(own.indexOf(canvas), 1);
          rename();
        },
      };
    },
    claim(box, state) {
      if (!roaming) {
        stopWatching ??= watch();
        const canvas = document.createElement("canvas");

        canvas.setAttribute("aria-hidden", "true");
        canvas.style.cssText =
          "position: absolute; inset: 0; display: block; width: 100%; height: 100%; pointer-events: none";

        const runtime = roam(
          canvasSurface(canvas, () => shown.screen),
          state
        );

        const shown = show(canvas, runtime, state);

        roaming = { canvas, runtime, stop: shown.stop };
      }

      const { canvas } = roaming;

      return roaming.runtime.claim(
        {
          // First in the box, so the box's own children, such as the
          // stage's button, paint above it.
          // The name rides on the canvas, so a view transition pairs the
          // canvas with itself wherever it moves.
          hold() {
            box.prepend(canvas);
            held = true;
            rename();
          },
          letGo() {
            if (canvas.parentElement === box) canvas.remove();
            held = false;
            rename();
          },
        },
        state
      );
    },
    dispose() {
      roaming?.canvas.remove();
      roaming?.stop();
      roaming = null;
      held = false;
      rename();
    },
  };
}
