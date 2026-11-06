"use client";

/*
 * kevelle/waveform: the site's one living waveform, in four forms. It draws
 * the Kevelle Oscilloscope's figures with the same parts, kevelle/scope on a
 * kevelle/phosphor screen.
 *
 *   import { Waveform, WaveformProvider } from "@/components/waveform/waveform"
 *   import { WaveformPanel } from "@/components/waveform/panel"
 *   import { parseWaveformConfig } from "@/components/waveform/settings"
 *
 *   // the root layout
 *   <WaveformProvider config={local ?? saved} onConfigChange={setLocal} audio={tap}>
 *     <Waveform form="glow" anchor={sectionOne} present={!home}
 *       className="fixed inset-0 -z-10" />
 *     {children}
 *   </WaveformProvider>
 *
 *   // the live figure: one slot per place. Home's stage plays the page's keys.
 *   <Waveform form="stage" keys="page" className="aspect-square w-full max-w-162" />
 *   <Waveform form="screen" className="size-full" />   inside the player
 *
 *   // the mark, beside the name on pages other than home
 *   <Waveform form="mark" className="size-5" />
 *
 * One live figure, in one place at a time. The provider owns one figure and
 * one roaming canvas for the stage and the screen. Each of those Waveforms
 * is a slot. It renders its box and, in a layout effect, claims the canvas,
 * which moves into the box. The newest slot holds it. When that slot
 * unmounts, the canvas goes back to the newest slot still mounted, so a site
 * places the live figure by the slots it mounts: the stage on home, and the
 * player's screen for as long as the player is on screen, paused included.
 * A commit that unmounts one slot and mounts another hands the live canvas
 * across with its history, its producer, and its presence: no new canvas,
 * no rebuild, and no fade. So a player that changes between card, mini, and
 * bar keeps the figure if each shape mounts its screen slot in the commit
 * that unmounts the last one. Slots that mount in one commit claim in tree
 * order, so the last one holds the canvas, and the others show empty boxes.
 *
 * Two more instances. "mark" is the figure beside the name. It draws the
 * page's figure by default, simplified so it reads at 20 px: the nearest
 * fraction with terms up to 5, so Golden's 1:φ draws 3:5, on its own tones
 * in tune, in up to three copies, on a short trail with no bloom. It turns
 * with the page's figure, precesses as slowly as the page's figure drifts,
 * up to 0.1 Hz, and swells with the audio and strikes. It holds only
 * under the provider's `hold` or reduced motion, as the others do, and
 * shows at full strength from its first frame. It draws on a canvas of its
 * own, so it can share a page with the player.
 * "glow" draws on a canvas of its own behind the page.
 *
 * View transitions. The live canvas carries view-transition-name "waveform",
 * the provider's viewTransitionName, while a slot holds it, so a view
 * transition pairs the canvas with itself and morphs it from its old slot to
 * its new one. While no slot holds it, the newest mark borrows the name, so
 * leaving home for a page without a player morphs the live stage into the
 * mark. The glow carries "waveform-glow". It sits behind every page,
 * so a site can hold it still while the page changes around it, as in
 * ::view-transition-group(waveform-glow) { animation: none }. Under
 * prefers-reduced-motion none of them carries a name, so nothing of the
 * waveform pairs or animates. The contract these names share with
 * WavePlayer:
 *
 *   - One element per name on screen. The engine sets every name in one
 *     place, takes a name off before it puts one on, and skips a name that
 *     another canvas on the page already carries, with a console warning.
 *     A second provider on a page takes another viewTransitionName, or null
 *     for none, since a repeated name stops every view transition on the
 *     page.
 *   - WavePlayer's frame carries "wave-player".
 *   - The figure rides above the frames it crosses. Add
 *     ::view-transition-group(waveform) { z-index: 1 } to the site's CSS. A
 *     frame that enters with the move, such as a player that appears,
 *     otherwise stacks above the figure and covers it.
 *
 * React 19.3's <ViewTransition> starts the browser's view transition for a
 * Transition, such as a Next.js navigation or a startTransition update,
 * that touches a <ViewTransition> with an animation, such as WavePlayer's
 * frame. The canvas needs nothing more, since its name is on the element.
 * Without one, call document.startViewTransition(() => flushSync(update)).
 * Either way the slots and the mark take and pass the name in layout
 * effects, which run inside the transition's update, so the browser
 * captures the canvas in its new box.
 *
 * Keys for everyone, configs from the dashboard. onConfigChange receives
 * the panel's edits and the keys' play, and decides what they do. A public
 * site passes config={local ?? saved} and onConfigChange={setLocal}, so
 * anyone can play with the figure and nothing saves. Pass back the object
 * onConfigChange gives you, since the keys know their own commits by
 * identity. A config they didn't make ends the play and becomes where
 * Escape returns. The dashboard's panel saves through its own provider.
 * Without onConfigChange the stage only strikes.
 *
 * Keys. WAVEFORM_KEYS in ./keys.ts says what each key does, by its place on
 * the keyboard. A S D F G H J K and W E T Y U are notes, laid out as on
 * Ableton Live's computer keyboard. Each plays Y over X at a just interval.
 * N and M step the ratio, and the figure closes as it lands. Z and X move
 * Y's frequency, freeing Y from a ratio first at the pitch it draws, as the
 * panel's Free does. C and V move X's frequency, and Y's with it while a
 * ratio locks it, the arrows turn the figure and move Y's phase, [ and ]
 * the drift, and - and = the size, a step a tap and a sweep while held,
 * four times as far and as fast with Shift. Comma and Period step Y's wave,
 * Semicolon and Quote the copies, 1 to 0 pick the first ten presets, and
 * Space strikes. ./keys.ts holds the key copy, which is a draft.
 *
 * Where keys play. A stage plays them while it has focus. Home's stage
 * takes keys="page", so it also plays them with nothing focused, while
 * that stage is mounted and present, until the visitor turns page keys off
 * with the key guide's switch, as WCAG 2.1.4 asks. The switch lasts as long
 * as the provider, and the focused stage still plays, so a visitor can turn
 * them back on. A host that shows its own page keys switch reads and sets
 * the same setting with useWaveformPageKeys(), which is null without
 * onConfigChange, and keeps keys="page" on the stage, so that one setting
 * decides. Keys stand down with Ctrl, Meta, or Alt, during IME
 * composition, after another handler took the key, while a modal dialog is
 * open, and while a text field has focus, and a focused control keeps its
 * own Space, Enter, arrows, Home, End, Page Up, Page Down, and Escape.
 *
 * Play. Presses glide, a sweep key steps at each press and sweeps on while
 * held, and a first press touches the figure. Play draws at once on every
 * live form. While it moves, onConfigChange receives what it shows every
 * frame, numbers as drawn and choices as they land, so the panel moves
 * with the figure, and once it rests, the play's landing itself. A frame
 * that shows nothing new commits nothing, and under
 * reduced motion each press commits once. Escape glides back to the last
 * config the page passed that the keys didn't make. ? toggles the key
 * guide, a non-modal popover over the stage that keeps the keys playing,
 * and Escape closes it first. Under reduced motion every key stays, a sweep
 * key moves one step a press, and every change is instant.
 *
 * Forms. Every form fills the box its className gives it, and the forms
 * that draw the shared figure draw it at the same phase. "stage" is the
 * figure edge to edge in its box. "glow" is larger and blurred, framed by
 * its anchor's width and centered on the anchor's x and the box's vertical
 * middle, never wider than the box's shorter side. Give it a box behind the
 * page's solid sections, and the light shows around them. "screen" fills a
 * player's square slot, and "mark" sits beside a name. Rotation, spin, and
 * symmetry copies shrink a form's figure just enough that every copy stays
 * inside its square at any angle, and an unturned figure keeps its size.
 * Each form has its own size, strength, depth, reactivity, and figure in
 * the config. Everything else is shared.
 *
 * A form's figure is "shared" or a ratio. A ratio draws a simplified
 * version of the shared figure that stays legible at 20 px: X's frequency,
 * both waves, and both phases, with Y locked to that ratio and both tones
 * in tune, in XY, in one copy, on a short trail with no bloom. It turns
 * with the shared figure's rotation and spin, and drifts Y 0.05 Hz, so it
 * moves slowly through its family. It draws the tones even under source
 * "audio", and the audio still brightens and swells it. Every form draws
 * the shared figure by default, the mark in its simplified form.
 *
 * Contracts. Client components, safe to render on the server: nothing
 * touches window during import or render, the glow and the mark attach to
 * their canvases in layout effects, and the roaming canvas joins a slot in
 * one. Put the provider in the root layout so the figure survives
 * navigation, and hold the anchor in state through a callback ref, so it
 * follows route changes. The config is plain JSON. Store it as is and pass
 * what comes back through parseWaveformConfig, the one boundary for stored
 * JSON. className takes layout classes only.
 *
 * Resets and links. WaveformPanel resets each section to
 * DEFAULT_WAVEFORM_CONFIG, and WaveformResetAllButton, in ./panel.tsx,
 * resets every control. WaveformRandomizeButton draws a new figure with
 * randomFigure(config) in ./settings.ts: the tones, the motion, and the
 * light's shape, in one edit, as a preset is. A page places both buttons in
 * its own toolbar, beside the panel. resetControls(config, ids) in
 * ./settings.ts resets any controls. writeWaveformSearch(search, config)
 * puts a config in a URL's query, one param per field that differs from the
 * default, keyed by control id, and readWaveformSearch(search) reads it back
 * through parseWaveformConfig. A link carries the config only, never the
 * input. Read it once, when the page mounts, since a config the keys didn't
 * make ends their play.
 *
 * Presence. The live figure arrives when the first slot claims the canvas,
 * and the glow when it mounts. Arriving turns the beam on, so the phosphor
 * builds the figure over its trail, while the canvas fades in over 1.6 s.
 * A slot's `present` applies while it holds the canvas. false departs: the
 * beam turns off, so the afterglow fades, and the canvas fades out over
 * 2.6 s.
 * Then the form clears its screen and does no GPU work. A change of form,
 * by a hand-off or a slot's `form` prop, moves the figure at once and eases
 * strength, depth, and size over 280 ms, about as long as a view
 * transition, while the afterglow fades where it was.
 *
 * Hold. The provider's `hold` says what every form under it does. Absent
 * or null, they move, and under prefers-reduced-motion they are still.
 *
 *   <WaveformProvider config={config} audio={feed} hold={paused ? "frozen" : null}>
 *
 * "still" draws one second of the figure and holds it: after it starts,
 * after a form or anchor change, after a theme change that changes its
 * light, after its box resizes or its anchor's x or width changes, after
 * the GPU recovers, after a pause cuts its second short, and 150 ms after
 * the config stops changing. While configs keep coming, from a slider drag,
 * a held key, or the play of another provider, it keeps the second it
 * holds, then settles once on the last. Each form draws the same second of
 * its figure, as the figure stands at its end, so forms that mount at
 * different times hold the same figure. Audio and strikes never start it
 * again, and presence fades its opacity only.
 * "frozen" stops every form where it stands. The screen keeps what it drew,
 * and the form's brightness and bloom stay where they froze, so audio and
 * strikes don't move it, and it reads no audio and does no GPU work. A
 * frozen form draws the still instead where it can't keep what it drew:
 * when it has drawn nothing yet, once a config change settles, after a
 * form, anchor, or light change, after the GPU recovers, after an anchored
 * form's framing or the box's aspect changes, and when its box grows past
 * 1.25 times the smallest it has shown the frozen figure in. A smaller box,
 * or one a little larger, keeps it, resampled. A held still stays still
 * under "frozen". Back to null, every form draws live from the frame heard
 * then, with no backlog.
 *
 * Theme. The engine follows the `dark` or `light` class next-themes sets on
 * <html>, then prefers-color-scheme, and draws on a transparent canvas over
 * either. "auto" color is astral on light, where the light keeps its hue and
 * stays translucent, never ink. On dark it is P31's own green on P31 and
 * phosphor on any other screen. Picking a signal color for either trace
 * also picks the Neutral screen, so the trace shows the token's own color.
 * The screen form is the exception: it draws on the dark ground, with
 * dark's "auto" color, in both themes, so its host must be a dark box in
 * both, as kevelle/wave-player's Screen is.
 *
 * Type. The key guide's caps, the panel's value readouts, and the panel's
 * and the source picker's choices keep the pixel size and take
 * --font-label. It defaults to --font-pixel, so Kevelle looks the same
 * until a host sets the label font to its own face.
 *
 * Audio and strikes. `audio` is a kevelle/audio SampleFeed, such as a
 * player's tap, or null. Its level, and a strike, kick each form outward and
 * flare its bloom, by up to a quarter of its size and 1.5 of bloom at full
 * reactivity. A strike at the stage's default reactivity, 0.4, grows it by
 * 9% and lifts its bloom by 0.54. Below full strength they also brighten a
 * form, by up to half again. All of it rises in about 15 ms and falls over
 * 1.5 s, so it cannot flash. With source "audio" the shared figure is the
 * music itself while it plays, and the tones otherwise.
 *
 * Input. useWaveformInput(config, onConfigChange), in ./input.tsx, feeds
 * the waveform from an input device or a file, as the Oscilloscope's
 * sources do, or from nothing on Tones, where the figure draws its own
 * tones. Call it where the provider is, with the provider's config and
 * change handler, and pass its feed to the provider's audio:
 *
 *   import { useWaveformInput, WaveformInputPicker } from "@/components/waveform/input"
 *
 *   const input = useWaveformInput(config, setConfig)
 *
 *   <WaveformProvider config={config} onConfigChange={setConfig} audio={input.feed}>
 *     <WaveformPanel input={input} />   or <WaveformInputPicker input={input} /> alone
 *   </WaveformProvider>
 *
 * The hook's source and the config's source are one choice. Tones is
 * source "tones", and Input and File are "audio", so the figure draws the
 * feed while it plays. setSource() and openFile() write the config's source
 * through onConfigChange, and a config that turns to "tones" elsewhere, by
 * a reset or a link, stops the input. A config on "audio" starts the hook on
 * Input, not listening, so nothing prompts. Tones listens to nothing, and
 * the feed stays null.
 *
 * The hook opens one silent strip on the page's kevelle/audio station for
 * as long as it is mounted: tapped, level 0, and monitor off, so nothing
 * reaches the speakers. Unmounting closes it and stops the microphone. A
 * file loops. It returns the feed, the source, the file, the devices, the
 * person's device choice, whether it is listening, a status, and
 * setSource(), choose(), listen(), stop(), and openFile(). Call listen()
 * and setSource() from a click, so the station starts inside the gesture.
 * The device choice is the station's, remembered for the origin and shared
 * with the Oscilloscope, so a reload or another page opens the same device.
 * A next visit listens again by itself only when the last one ended
 * listening to input and the microphone permission reads "granted", so the
 * page never prompts on load, and it moves the config's source to "audio".
 * A Listen, Stop, source pick, or file before the permission answers wins,
 * and the visit does not resume.
 * A browser that holds audio until a gesture reads "suspended" until the
 * next Listen. WaveformInputPicker is its controls: the source, the device,
 * a file, Listen or Play and Stop, and the status, from Kevelle ui/* parts
 * only. It keeps no state, so a page can render it twice. WaveformPanel
 * shows it in its Source section, in place of the source control, when it
 * gets `input`. Its copy is a draft, kept in one place in ./input.tsx.
 *
 * The stage. While present, its box carries a transparent button over the
 * canvas, with an accessible name, aria-keyshortcuts for every key, and no
 * ring, outline, or border. Keyboard focus shows through the figure: its
 * bloom lifts over 280 ms, at once when still, and a caption shows at the
 * box's bottom edge, so focus also reads as text. With keys, the caption says
 * they exist, and it also shows after the pointer rests 600 ms on the stage,
 * and for 3 s after a printable key that plays nothing. Without them it says
 * how to strike. Pressing the button, or Space or Enter while it has focus,
 * strikes the waveform. hint={false} drops the caption, and the button's
 * aria-describedby with it, for a host that teaches the keys its own way;
 * focus then shows only through the bloom, and ? still opens the key guide
 * where a one-line caption would hold it. An absent stage drops the button.
 * useWaveform().strike() strikes from a page's own control, and
 * WaveformPanel, in ./panel.tsx, edits every setting.
 */

import * as React from "react";
import { cn } from "cn";

import type { SampleFeed } from "@/lib/audio";
import { Field, FieldLabel } from "@/components/ui/field";
import { Kbd } from "@/components/ui/kbd";
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";

import {
  createWaveform,
  type AttachedForm,
  type Claim,
  type WaveformEngine,
} from "./engine";
import type { WaveformHold } from "./figure";
import {
  COPY,
  GUIDE_KEY,
  HOME_KEY,
  WAVEFORM_KEYS,
  createPlayer,
  entryFor,
  guideOf,
  shortcutsOf,
  standsDown,
  type KeyInput,
  type Player,
} from "./keys";
import type { Form, WaveformConfig } from "./settings";

export type { WaveformHold } from "./figure";

/** The keys a stage plays, under a provider with onConfigChange. */
type StageKeys = {
  readonly player: Player;
  /** The key guide's switch for page-wide keys. Lasts as long as the provider. */
  readonly pageKeys: boolean;
  setPageKeys(on: boolean): void;
};

type WaveformContextValue = {
  readonly engine: WaveformEngine;
  readonly config: WaveformConfig;
  readonly onConfigChange: ((config: WaveformConfig) => void) | null;
  readonly keys: StageKeys | null;
};

const WaveformContext = React.createContext<WaveformContextValue | null>(null);

function useWaveformContext(caller: string): WaveformContextValue {
  const context = React.use(WaveformContext);

  if (!context) throw new Error(`${caller} needs a WaveformProvider above it.`);

  return context;
}

export type WaveformProviderProps = {
  /** The whole config. A stored one goes through parseWaveformConfig first. */
  readonly config: WaveformConfig;
  /** Called with the next config from the panel and the stage's keys. Without it they change nothing. */
  readonly onConfigChange?: (config: WaveformConfig) => void;
  /** The audio the waveform reacts to, or draws under source "audio". */
  readonly audio?: SampleFeed | null;
  /**
   * The roaming canvas's view-transition-name, read when the provider
   * mounts. The glow takes it with "-glow". Default "waveform". A second
   * provider on the same page needs another name, or null for none, since
   * two elements with one name stop every view transition on the page.
   */
  readonly viewTransitionName?: string | null;
  /**
   * What every form under the provider does. Absent or null, they move.
   * "frozen" stops them where they stand until it changes. "still" draws
   * one second of the figure and holds it, as reduced motion does. Read
   * every render.
   */
  readonly hold?: WaveformHold | null;
  readonly children: React.ReactNode;
};

export function WaveformProvider({
  config,
  onConfigChange,
  audio = null,
  viewTransitionName = "waveform",
  hold = null,
  children,
}: WaveformProviderProps) {
  // The engine holds no resources until a form attaches or a slot claims its
  // canvas, so it is plain state for the provider's lifetime and safe to
  // create on the server.
  const [engine] = React.useState(() =>
    createWaveform({ config, audio, hold, viewTransitionName })
  );

  // Lambdas, so nothing touches window while rendering on the server.
  const [player] = React.useState(() =>
    createPlayer(engine, config, {
      request: (tick) => requestAnimationFrame(tick),
      cancel: (id) => cancelAnimationFrame(id),
    })
  );

  const [pageKeys, setPageKeys] = React.useState(true);

  // The hold lands in the same task as the config, so a look and a hold
  // that change in one render reach the forms with no frame between them.
  React.useEffect(() => {
    player.sync({ config, audio, onConfigChange: onConfigChange ?? null });
    engine.hold(hold);
  }, [engine, player, config, audio, onConfigChange, hold]);

  // The slots release in layout cleanups, before this runs.
  React.useEffect(
    () => () => {
      player.dispose();
      engine.dispose();
    },
    [engine, player]
  );

  const value = React.useMemo(
    () => ({
      engine,
      config,
      onConfigChange: onConfigChange ?? null,
      keys: onConfigChange ? { player, pageKeys, setPageKeys } : null,
    }),
    [engine, config, onConfigChange, player, pageKeys]
  );

  return <WaveformContext value={value}>{children}</WaveformContext>;
}

/** Strikes the waveform under the nearest provider, from a page's own control. */
export function useWaveform(): { strike(): void } {
  const { engine } = useWaveformContext("useWaveform");

  return React.useMemo(() => ({ strike: engine.strike }), [engine]);
}

/**
 * The key guide's page keys switch, for a host that shows its own. It is
 * the provider's one setting, so the host's control and the guide's switch
 * always agree. Null without onConfigChange, where the stage has no keys.
 */
export function useWaveformPageKeys(): Pick<
  StageKeys,
  "pageKeys" | "setPageKeys"
> | null {
  const { keys } = useWaveformContext("useWaveformPageKeys");

  return keys
    ? { pageKeys: keys.pageKeys, setPageKeys: keys.setPageKeys }
    : null;
}

/** The provider's config and its change handler, for an editor such as WaveformPanel. */
export function useWaveformConfig() {
  const { config, onConfigChange } = useWaveformContext("useWaveformConfig");

  return { config, onConfigChange };
}

type Placement = {
  /** The element whose width frames the figure and whose x centers it, usually section 1 for the glow. Default: the box's shorter side, centered. */
  readonly anchor?: Element | null;
  /** Default true. false departs over 2.6 s; true arrives over 1.6 s. */
  readonly present?: boolean;
  /** Layout classes only: size and placement. The form fills this box, with no border or shadow of its own. */
  readonly className?: string;
};

/** Where a stage's keys play: while it has focus, or also with nothing focused on the page. */
export type StageKeysScope = "focus" | "page";

export type WaveformProps = Placement &
  (
    | {
        readonly form: "stage";
        /**
         * Default "focus": the keys play while the stage has focus.
         * "page" also plays them with nothing focused, while this stage is
         * mounted and present, until the visitor turns page keys off in the
         * key guide.
         */
        readonly keys?: StageKeysScope;
        /**
         * Default true: the caption at the stage's bottom edge, which says
         * how to play it on focus, dwell, and stray keys. false renders no
         * caption and drops the button's aria-describedby.
         */
        readonly hint?: boolean;
      }
    | {
        readonly form: Exclude<Form, "stage">;
        readonly keys?: never;
        readonly hint?: never;
      }
  );

export function Waveform(props: WaveformProps) {
  return props.form === "stage" || props.form === "screen" ? (
    <Slot {...props} />
  ) : (
    <Own key={props.form} {...props} />
  );
}

/** The glow or the mark, on a canvas of its own. */
function Own({
  form,
  anchor = null,
  present = true,
  className,
}: WaveformProps) {
  const { engine } = useWaveformContext("Waveform");
  const canvas = React.useRef<HTMLCanvasElement>(null);
  const attached = React.useRef<AttachedForm | null>(null);
  const state = { form, anchor, present };
  const initial = React.useEffectEvent(() => state);

  // Layout effects, so a mark that mounts with a view transition takes the
  // roaming canvas's name before the transition captures the new state.
  React.useLayoutEffect(() => {
    const element = canvas.current;

    if (!element) return;
    const created = engine.attach(element, initial());
    attached.current = created;

    return () => {
      created.destroy();
      attached.current = null;
    };
  }, [engine]);

  React.useLayoutEffect(() => {
    attached.current?.set({ form, anchor, present });
  }, [form, anchor, present]);

  return (
    <div className={cn("relative", className)}>
      <canvas
        ref={canvas}
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 block size-full"
      />
    </div>
  );
}

/** A box for the provider's roaming canvas: the stage or the screen. */
function Slot({
  form,
  anchor = null,
  present = true,
  keys = "focus",
  hint = true,
  className,
}: WaveformProps) {
  const { engine } = useWaveformContext("Waveform");
  const box = React.useRef<HTMLDivElement>(null);
  const claim = React.useRef<Claim | null>(null);
  const [focused, setFocused] = React.useState(false);
  const staged = form === "stage" && present;
  const lit = staged && focused;
  const state = { form, anchor, present, lit };
  const initial = React.useEffectEvent(() => state);

  // Layout effects, so a hand-off between slots in one commit happens
  // inside a view transition's update, before it captures the new state.
  React.useLayoutEffect(() => {
    const element = box.current;

    if (!element) return;
    const created = engine.claim(element, initial());
    claim.current = created;

    return () => {
      created.release();
      claim.current = null;
    };
  }, [engine]);

  React.useLayoutEffect(() => {
    claim.current?.set({ form, anchor, present, lit });
  }, [form, anchor, present, lit]);

  return (
    <div ref={box} className={cn("relative", className)}>
      {staged ? (
        <Stage scope={keys} captioned={hint} onLit={setFocused} />
      ) : null}
    </div>
  );
}

const REDUCED_MOTION = "(prefers-reduced-motion: reduce)";

/**
 * An open modal dialog takes every key. ARIA dialogs and native ones say so
 * themselves, and one kept mounted but hidden is closed. Base UI's, such as
 * a Cmd-K palette, hide the page around them instead, so the stage reads as
 * under a modal once an ancestor is inert or hidden.
 */
const MODAL = '[aria-modal="true"], dialog:modal';

const HIDDEN = '[inert], [aria-hidden="true"]';

/** Fields that take text. */
const TEXT_FIELD =
  'input:not([type="button"], [type="checkbox"], [type="color"], [type="file"], [type="image"], [type="radio"], [type="range"], [type="reset"], [type="submit"]), textarea, select, [role="textbox"], [role="searchbox"], [role="combobox"], [role="spinbutton"]';

/** Widgets whose type-ahead takes letters. */
const TYPEAHEAD =
  '[role="listbox"], [role="menu"], [role="menubar"], [role="tree"]';

/** The pointer rests this long on the stage before the hint shows. */
const DWELL_MS = 600;

/** The hint shows this long after a printable key that plays nothing. */
const STRAY_MS = 3000;

function focusOf(element: Element | null): KeyInput["focus"] {
  if (
    !element ||
    element === document.body ||
    element === document.documentElement
  )
    return "page";

  return (element instanceof HTMLElement && element.isContentEditable) ||
    element.matches(TEXT_FIELD) ||
    element.closest(TYPEAHEAD)
    ? "text"
    : "control";
}

function keyInputOf(
  event: KeyboardEvent,
  focus: KeyInput["focus"],
  stage: Element | null
): KeyInput {
  return {
    key: event.key,
    code: event.code,
    shiftKey: event.shiftKey,
    ctrlKey: event.ctrlKey,
    metaKey: event.metaKey,
    altKey: event.altKey,
    repeat: event.repeat,
    isComposing: event.isComposing,
    defaultPrevented: event.defaultPrevented,
    focus,
    modal:
      [...document.querySelectorAll(MODAL)].some(
        (dialog) => dialog.getClientRects().length > 0
      ) || stage?.closest(HIDDEN) != null,
  };
}

/** Why the hint shows. At rest, for none of them. */
type Hint = {
  /** The pointer rested on the stage. */
  readonly dwell: boolean;
  /** The stage has keyboard focus. */
  readonly focus: boolean;
  /** A printable key that played nothing, a moment ago. */
  readonly stray: boolean;
};

const AT_REST: Hint = { dwell: false, focus: false, stray: false };

type Timer = ReturnType<typeof setTimeout>;

/** The stage's strike button, its hint unless the host turns it off, and with keys, its key guide. */
function Stage({
  scope,
  captioned,
  onLit,
}: {
  readonly scope: StageKeysScope;
  readonly captioned: boolean;
  readonly onLit: (lit: boolean) => void;
}) {
  const { engine, keys } = useWaveformContext("Waveform");
  const button = React.useRef<HTMLButtonElement>(null);
  const hintId = React.useId();
  const [guide, setGuide] = React.useState(false);
  const [hint, setHint] = React.useState(AT_REST);
  const dwell = React.useRef<Timer | null>(null);
  const stray = React.useRef<Timer | null>(null);
  const player = keys?.player ?? null;
  const paging = scope === "page" && keys !== null && keys.pageKeys;

  function strayKey() {
    if (stray.current) clearTimeout(stray.current);
    setHint((last) => (last.stray ? last : { ...last, stray: true }));

    stray.current = setTimeout(
      () => setHint((last) => ({ ...last, stray: false })),
      STRAY_MS
    );
  }

  /** Plays one keydown, from the stage's own handler or the page's. */
  function keyDown(event: KeyboardEvent, focus: KeyInput["focus"]) {
    if (!keys) return;
    const input = keyInputOf(event, focus, button.current);

    if (standsDown(input)) return;
    const at = event.timeStamp;
    const reduced = matchMedia(REDUCED_MOTION).matches;

    if (input.key === HOME_KEY && guide) {
      event.preventDefault();
      setGuide(false);

      return;
    }

    if (input.key === GUIDE_KEY) {
      event.preventDefault();
      setGuide(!guide);

      return;
    }

    if (input.key === HOME_KEY) {
      if (keys.player.home(at, reduced)) event.preventDefault();

      return;
    }

    const hit = entryFor(WAVEFORM_KEYS, input);

    if (!hit) {
      if (captioned && input.key.length === 1) strayKey();

      return;
    }

    event.preventDefault();
    keys.player.keyDown(hit, input, at, reduced);
  }

  const onPageKey = React.useEffectEvent((event: KeyboardEvent) => {
    // The stage's own handler has the keys it has focus for.
    if (event.target === button.current) return;
    keyDown(event, focusOf(document.activeElement));
  });

  React.useEffect(() => {
    if (!paging) return;
    const listener = (event: KeyboardEvent) => onPageKey(event);

    document.addEventListener("keydown", listener);

    return () => document.removeEventListener("keydown", listener);
  }, [paging]);

  // Keyups release wherever focus went, even while the keys stand down, so
  // no sweep sticks. A blur, a hidden page, or an unmount loses the keyups,
  // so it releases everything held.
  React.useEffect(() => {
    if (!player) return;

    const up = (event: KeyboardEvent) =>
      player.keyUp(event.code, event.timeStamp);

    const lost = () => player.letGo(performance.now());

    const hidden = () => {
      if (document.hidden) lost();
    };

    document.addEventListener("keyup", up);
    window.addEventListener("blur", lost);
    document.addEventListener("visibilitychange", hidden);

    return () => {
      document.removeEventListener("keyup", up);
      window.removeEventListener("blur", lost);
      document.removeEventListener("visibilitychange", hidden);
      lost();
    };
  }, [player]);

  React.useEffect(
    () => () => {
      if (dwell.current) clearTimeout(dwell.current);

      if (stray.current) clearTimeout(stray.current);
      onLit(false);
    },
    [onLit]
  );

  // Keyboard focus always shows the caption, so focus reads as text even
  // where the bloom lift has no room, at the bloom's limit.
  const shown = hint.focus || (keys !== null && (hint.dwell || hint.stray));

  const caption = captioned ? (
    <span
      id={hintId}
      data-shown={shown ? "" : undefined}
      className="bg-background type-caption text-muted-foreground px-2 py-1 opacity-0 transition-opacity duration-(--duration-small) ease-out data-shown:opacity-100"
    >
      {keys ? COPY.hint : COPY.strikeHint}
    </span>
  ) : null;

  const edge =
    "pointer-events-none absolute inset-x-0 bottom-3 flex justify-center";

  return (
    <>
      <button
        ref={button}
        type="button"
        aria-label={COPY.stage}
        aria-keyshortcuts={keys ? shortcutsOf(WAVEFORM_KEYS) : undefined}
        aria-describedby={captioned ? hintId : undefined}
        onClick={engine.strike}
        onKeyDown={(event) => {
          // Space and Enter strike through the button's own click.
          if (event.key === " " || event.key === "Enter") return;
          keyDown(event.nativeEvent, "page");
        }}
        onFocus={(event) => {
          const visible = event.currentTarget.matches(":focus-visible");

          onLit(visible);
          setHint((last) => ({ ...last, focus: visible }));
        }}
        onBlur={() => {
          onLit(false);
          setHint((last) => ({ ...last, focus: false }));
        }}
        onPointerMove={(event) => {
          if (!captioned || event.pointerType === "touch" || hint.dwell) return;

          if (dwell.current) clearTimeout(dwell.current);

          dwell.current = setTimeout(
            () => setHint((last) => ({ ...last, dwell: true })),
            DWELL_MS
          );
        }}
        onPointerLeave={() => {
          if (dwell.current) clearTimeout(dwell.current);
          dwell.current = null;
          setHint((last) => (last.dwell ? { ...last, dwell: false } : last));
        }}
        className="absolute inset-0 size-full outline-none"
      />
      {keys ? (
        <Popover open={guide} onOpenChange={setGuide}>
          {/* The guide's anchor along the stage's bottom edge, holding the hint, or without it a blank of the caption's one-line height, so the guide opens where it would over an unwrapped caption. Hidden and out of reach, so only ? opens the guide. */}
          <PopoverTrigger
            nativeButton={false}
            tabIndex={-1}
            aria-hidden="true"
            render={<span />}
            className={edge}
          >
            {caption ?? <span className="type-caption box-content h-lh py-1" />}
          </PopoverTrigger>
          <PopoverContent side="top" initialFocus={false} finalFocus={button}>
            <PopoverTitle>{COPY.guide}</PopoverTitle>
            <PopoverDescription>
              {scope === "page" ? COPY.pageWide : COPY.focusOnly} {COPY.faster}
            </PopoverDescription>
            <dl className="flex flex-col gap-2">
              {guideOf(WAVEFORM_KEYS).map((row) => (
                <div
                  key={row.label}
                  className="flex items-center justify-between gap-3"
                >
                  <dt className="type-caption">{row.does}</dt>
                  <dd>
                    <Kbd face="label">{row.label}</Kbd>
                  </dd>
                </div>
              ))}
            </dl>
            {scope === "page" ? (
              <Field>
                <div className="flex min-h-8 items-center justify-between gap-3 pointer-coarse:min-h-11">
                  <FieldLabel>{COPY.pageKeys}</FieldLabel>
                  <Switch
                    aria-label={COPY.pageKeys}
                    checked={keys.pageKeys}
                    onCheckedChange={keys.setPageKeys}
                  />
                </div>
              </Field>
            ) : null}
          </PopoverContent>
        </Popover>
      ) : caption ? (
        <span aria-hidden="true" className={edge}>
          {caption}
        </span>
      ) : null}
    </>
  );
}
