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
 *   // the live figure: one slot per place
 *   <Waveform form="stage" className="aspect-square w-full max-w-162" />
 *   <Waveform form="screen" className="size-full" />   inside the player
 *
 *   // the static mark, beside the name on pages other than home
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
 * Two more instances. "mark" is the static figure beside the name: the same
 * look, color, and screen with no motion, always still whatever `still` or
 * reduced motion say, and shown at full strength from its first frame. It
 * draws on a canvas of its own, so it can share a page with the player.
 * "glow" draws on a canvas of its own behind the page.
 *
 * View transitions. The live canvas carries view-transition-name "waveform",
 * the provider's viewTransitionName, while a slot holds it, so a view
 * transition pairs the canvas with itself and morphs it from its old slot to
 * its new one. While no slot holds it, the newest mark borrows the name, so
 * leaving home for a page without a player morphs the live stage into the
 * static mark. The glow carries "waveform-glow". It sits behind every page,
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
 * the panel's and the stage's key edits and decides what they do. A public
 * site passes config={local ?? saved} and onConfigChange={setLocal}, so
 * anyone can play with the figure and nothing saves. The dashboard's panel
 * saves through its own provider. Without onConfigChange the stage only
 * strikes.
 *
 * Forms. Every form fills the box its className gives it, and the forms
 * that draw the shared figure draw it at the same phase. "stage" is the
 * figure edge to edge in its box. "glow" is larger and blurred, framed by
 * its anchor's width and centered on the anchor's x and the box's vertical
 * middle, never wider than the box's shorter side. Give it a box behind the
 * page's solid sections, and the light shows around them. "screen" fills a
 * player's square slot, and "mark" sits beside a name. Each form has its
 * own size, strength, depth, reactivity, and figure in the config.
 * Everything else is shared.
 *
 * A form's figure is "shared" or a ratio. A ratio draws a simplified
 * version of the shared figure that holds still: X's frequency, both
 * waves, and both phases, with Y locked to that ratio and both tones in
 * tune, in XY, in one copy with no motion, at the longest trail with no
 * bloom. It draws the tones even under source "audio", and the audio still
 * brightens and swells it. The mark draws 3:2 by default, because a dense
 * figure such as Golden fills a 20 px box solid. The other forms draw the
 * shared figure.
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
 * Still. Under prefers-reduced-motion, or with `still`, a form draws one
 * second of the figure and holds it: after it starts, after a config, form,
 * anchor, or theme change, after its box resizes or its anchor's x or width
 * changes, after the GPU recovers, and after a pause cuts its second short.
 * Each form draws the same second of its figure, as the figure stands at its
 * end, so forms that mount at different times hold the same figure. Audio
 * and strikes never start it again, and presence fades its opacity only.
 *
 * Theme. The engine follows the `dark` or `light` class next-themes sets on
 * <html>, then prefers-color-scheme, and draws on a transparent canvas over
 * either. "auto" color is astral on light, where the light keeps its hue and
 * stays translucent, never ink. On dark it is P31's own green on P31 and
 * phosphor on any other screen. Picking a signal color for either trace
 * also picks the Neutral screen, so the trace shows the token's own color.
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
 * The stage. While present, its box carries a transparent button over the
 * canvas, with an accessible name and a focus ring inside the box. A band
 * of the background lines the ring, so it reads against the figure. Pressing
 * it, or Space or Enter while it has focus, strikes the waveform. With
 * onConfigChange, the keys in ./keys.ts also change the figure while it has
 * focus. An absent stage drops the button. useWaveform().strike() strikes
 * from a page's own control, and WaveformPanel, in ./panel.tsx, edits every
 * setting.
 */

import * as React from "react";
import { cn } from "cn";

import type { SampleFeed } from "@/lib/audio";

import {
  createWaveform,
  type AttachedForm,
  type Claim,
  type WaveformEngine,
} from "./engine";
import { KEY_SHORTCUTS, STRIKE_SHORTCUTS, keyChange } from "./keys";
import type { Form, WaveformConfig } from "./settings";

type WaveformContextValue = {
  readonly engine: WaveformEngine;
  readonly config: WaveformConfig;
  readonly onConfigChange: ((config: WaveformConfig) => void) | null;
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
  readonly children: React.ReactNode;
};

export function WaveformProvider({
  config,
  onConfigChange,
  audio = null,
  viewTransitionName = "waveform",
  children,
}: WaveformProviderProps) {
  // The engine holds no resources until a form attaches or a slot claims its
  // canvas, so it is plain state for the provider's lifetime and safe to
  // create on the server.
  const [engine] = React.useState(() =>
    createWaveform({ config, audio, viewTransitionName })
  );

  React.useEffect(() => {
    engine.set({ config, audio });
  }, [engine, config, audio]);

  // The slots release in layout cleanups, before this runs.
  React.useEffect(() => () => engine.dispose(), [engine]);

  const value = React.useMemo(
    () => ({ engine, config, onConfigChange: onConfigChange ?? null }),
    [engine, config, onConfigChange]
  );

  return <WaveformContext value={value}>{children}</WaveformContext>;
}

/** Strikes the waveform under the nearest provider, from a page's own control. */
export function useWaveform(): { strike(): void } {
  const { engine } = useWaveformContext("useWaveform");

  return React.useMemo(() => ({ strike: engine.strike }), [engine]);
}

/** The provider's config and its change handler, for an editor such as WaveformPanel. */
export function useWaveformConfig() {
  const { config, onConfigChange } = useWaveformContext("useWaveformConfig");

  return { config, onConfigChange };
}

export type WaveformProps = {
  readonly form: Form;
  /** The element whose width frames the figure and whose x centers it, usually section 1 for the glow. Default: the box's shorter side, centered. */
  readonly anchor?: Element | null;
  /** Default true. false departs over 2.6 s; true arrives over 1.6 s. */
  readonly present?: boolean;
  /** Forces the reduced-motion still. Default false, which follows the system. */
  readonly still?: boolean;
  /** Layout classes only: size and placement. The form fills this box, with no border or shadow of its own. */
  readonly className?: string;
};

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
  still = false,
  className,
}: WaveformProps) {
  const { engine } = useWaveformContext("Waveform");
  const canvas = React.useRef<HTMLCanvasElement>(null);
  const attached = React.useRef<AttachedForm | null>(null);
  const state = { form, anchor, present, still };
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
    attached.current?.set({ form, anchor, present, still });
  }, [form, anchor, present, still]);

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
  still = false,
  className,
}: WaveformProps) {
  const { engine, config, onConfigChange } = useWaveformContext("Waveform");
  const box = React.useRef<HTMLDivElement>(null);
  const claim = React.useRef<Claim | null>(null);
  const state = { form, anchor, present, still };
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
    claim.current?.set({ form, anchor, present, still });
  }, [form, anchor, present, still]);

  const onKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    if (!onConfigChange) return;
    const next = keyChange(config, event);

    if (!next) return;
    event.preventDefault();

    if (next !== config) onConfigChange(next);
  };

  return (
    <div ref={box} className={cn("relative", className)}>
      {form === "stage" && present ? (
        <button
          type="button"
          aria-label="Waveform. Press to strike it."
          aria-keyshortcuts={onConfigChange ? KEY_SHORTCUTS : STRIKE_SHORTCUTS}
          onClick={engine.strike}
          onKeyDown={onKeyDown}
          className="focus-visible:ring-background focus-visible:inset-ring-ring absolute inset-0 size-full outline-none focus-visible:ring-5 focus-visible:inset-ring-2 focus-visible:ring-inset"
        />
      ) : null}
    </div>
  );
}
