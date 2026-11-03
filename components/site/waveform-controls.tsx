"use client";

/**
 * Home's waveform controls on desktop: the ghost "?" under the stage and the
 * key map at the top of the rail, built around the installed block's keys.
 * lib/waveform-controls.ts holds the rows and the state machine; this file
 * feeds it events and draws it.
 *
 * The block plays the keys and owns `?` for its own key guide. The site
 * takes `?` first, in a capturing listener that calls preventDefault, so the
 * block stands down (keys.ts standsDown) and its guide never opens. Escape
 * passes through after closing the controls, so the block still glides the
 * figure back to the saved look. A key the block played arrives on window,
 * after the block's listeners, with defaultPrevented set.
 *
 * Page-wide keys: the controls carry the switch that turns them off (WCAG
 * 2.1.4). Off, the stage takes keys="focus", and `?` works only with focus
 * on the stage, the ghost or the controls.
 */
import {
  useCallback,
  useEffect,
  useEffectEvent,
  useId,
  useLayoutEffect,
  useReducer,
  useRef,
  useState,
  type PointerEvent,
  type RefObject,
} from "react";
import { cn } from "@/lib/utils";
import { Switch } from "@/components/ui/switch";
import { useWaveformConfig } from "@/components/waveform/waveform";
import {
  COPY,
  GUIDE_KEY,
  HOME_KEY,
  standsDown,
  type KeyInput,
} from "@/components/waveform/keys";
import {
  CONTROL_ROWS,
  INITIAL_CONTROLS,
  controlsReducer,
  dueTimers,
  spotOf,
  type ControlsEvent,
  type ControlsState,
  type Pointer,
} from "@/lib/waveform-controls";

const REDUCED_MOTION = "(prefers-reduced-motion: reduce)";

/** E's ease for the ghost and the controls, as in app/globals.css. */
const EASE = "cubic-bezier(0.23, 1, 0.32, 1)";

/** E's reduced-motion column: the opacity fades it keeps. */
const GHOST_FADE = { in: 200, out: 150 };
const CONTROLS_FADE = { in: 120, out: 100 };

/*
 * The block decides whether it takes a key from what holds focus and
 * whether a modal is open, and doesn't export how it reads them. These
 * mirror waveform.tsx's focusOf and keyInputOf, so the site claims `?`
 * exactly when the block would have taken it.
 */
const MODAL = '[aria-modal="true"], dialog:modal';
const HIDDEN = '[inert], [aria-hidden="true"]';
const TEXT_FIELD =
  'input:not([type="button"], [type="checkbox"], [type="color"], [type="file"], [type="image"], [type="radio"], [type="range"], [type="reset"], [type="submit"]), textarea, select, [role="textbox"], [role="searchbox"], [role="combobox"], [role="spinbutton"]';
const TYPEAHEAD =
  '[role="listbox"], [role="menu"], [role="menubar"], [role="tree"]';

const STAGE = '[data-slot="waveform-stage"]';

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

function keyInputOf(event: KeyboardEvent, stage: Element | null): KeyInput {
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
    focus: focusOf(document.activeElement),
    modal:
      [...document.querySelectorAll(MODAL)].some(
        (dialog) => dialog.getClientRects().length > 0
      ) || stage?.closest(HIDDEN) != null,
  };
}

export type WaveformControlsApi = {
  readonly state: ControlsState;
  readonly dispatch: (event: ControlsEvent) => void;
  /** Page-wide keys, the switch in the controls. Lasts for the visit. */
  readonly pageKeys: boolean;
  readonly setPageKeys: (on: boolean) => void;
  readonly ghost: RefObject<HTMLButtonElement | null>;
  readonly panel: RefObject<HTMLElement | null>;
  readonly panelId: string;
};

/**
 * The controls' state, keys and timers. `active` while Home shows on
 * desktop; turning inactive, by leaving Home or narrowing the window,
 * closes everything.
 */
export function useWaveformControls(active: boolean): WaveformControlsApi {
  const [state, dispatch] = useReducer(controlsReducer, INITIAL_CONTROLS);
  const [pageKeys, setPageKeys] = useState(true);
  const ghost = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLElement>(null);
  const panelId = useId();

  useEffect(() => {
    if (!active) dispatch({ type: "leave" });
  }, [active]);

  useTimers(state, dispatch);

  /** Every event goes through here. A close moves focus out of the controls first, to the ghost, since they turn inert. */
  const send = useCallback((event: ControlsEvent) => {
    if (
      (event.type === "toggle" || event.type === "close") &&
      panel.current?.contains(document.activeElement)
    )
      ghost.current?.focus();
    dispatch(event);
  }, []);

  const onKeyDown = useEffectEvent((event: KeyboardEvent) => {
    const stage = document.querySelector(STAGE);
    const input = keyInputOf(event, stage);

    if (event.key === GUIDE_KEY) {
      if (standsDown(input)) return;
      const near = [stage, ghost.current, panel.current].some((element) =>
        element?.contains(document.activeElement)
      );

      if (!pageKeys && !near) return;
      event.preventDefault();
      send({ type: "toggle" });

      return;
    }

    // A focused control keeps Escape from the block, but it still closes these.
    if (
      event.key === HOME_KEY &&
      state.panel.kind === "open" &&
      !standsDown({ ...input, focus: input.focus === "text" ? "text" : "page" })
    )
      send({ type: "close" });
  });

  const onPlayed = useEffectEvent((event: KeyboardEvent) => {
    if (!event.defaultPrevented || event.repeat) return;
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    const spot = spotOf(event);

    if (spot) dispatch({ type: "press", spot, code: event.code });
  });

  useEffect(() => {
    if (!active) return;
    const down = (event: KeyboardEvent) => onKeyDown(event);
    const played = (event: KeyboardEvent) => onPlayed(event);
    const up = (event: KeyboardEvent) =>
      dispatch({ type: "lift", code: event.code });
    const lost = () => dispatch({ type: "lift" });

    document.addEventListener("keydown", down, { capture: true });
    window.addEventListener("keydown", played);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", lost);

    return () => {
      document.removeEventListener("keydown", down, { capture: true });
      window.removeEventListener("keydown", played);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", lost);
    };
  }, [active]);

  return {
    state,
    dispatch: send,
    pageKeys,
    setPageKeys,
    ghost,
    panel,
    panelId,
  };
}

/** Runs the timers the state asks for, each from when it first became due. */
function useTimers(
  state: ControlsState,
  dispatch: (event: ControlsEvent) => void
) {
  const running = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  useEffect(() => {
    const due = dueTimers(state);
    const live = running.current;

    for (const [id, handle] of live)
      if (!due.some((timer) => timer.id === id)) {
        clearTimeout(handle);
        live.delete(id);
      }

    for (const timer of due)
      if (!live.has(timer.id))
        live.set(
          timer.id,
          setTimeout(() => {
            live.delete(timer.id);
            dispatch(timer.event);
          }, timer.ms)
        );
  }, [state, dispatch]);

  useEffect(() => {
    const live = running.current;

    return () => {
      for (const handle of live.values()) clearTimeout(handle);
      live.clear();
    };
  }, []);
}

/** Pointer handlers for a zone: the stage with its gap and ghost, or the rail. Touch never dwells. */
export function pointerZone(
  controls: WaveformControlsApi,
  zone: Exclude<Pointer, "away">
) {
  const to =
    (where: Pointer) =>
    ({ pointerType }: PointerEvent) => {
      if (pointerType !== "touch")
        controls.dispatch({ type: "pointer", to: where });
    };

  return { onPointerEnter: to(zone), onPointerLeave: to("away") };
}

/**
 * Kevelle's reduced-motion rule cuts every CSS transition short, so under
 * reduced motion the opacity fades E keeps run as Web Animations, from
 * wherever the last one got to.
 */
function useReducedFade(
  ref: RefObject<HTMLElement | null>,
  shown: boolean,
  ms: { readonly in: number; readonly out: number }
) {
  const last = useRef(shown);
  const fade = useRef<Animation | null>(null);

  useLayoutEffect(() => {
    if (last.current === shown) return;
    last.current = shown;
    const element = ref.current;

    if (!element || !window.matchMedia(REDUCED_MOTION).matches) return;
    const from =
      fade.current?.playState === "running"
        ? Number(getComputedStyle(element).opacity)
        : Number(!shown);
    fade.current?.cancel();
    fade.current = element.animate(
      { opacity: [from, Number(shown)] },
      { duration: shown ? ms.in : ms.out, easing: EASE }
    );
  }, [ref, shown, ms]);
}

/**
 * The ghost "?", 24 under the stage on its axis. Its ::before spans that
 * gap, so the pointer crossing it never leaves the zone. Focus shows it,
 * since it is the next tab stop after the nav.
 */
export function WaveformGhost({
  controls,
}: {
  readonly controls: WaveformControlsApi;
}) {
  const { state, dispatch, ghost, panelId } = controls;
  const shown = state.panel.kind !== "rest";
  const open = state.panel.kind === "open";

  useReducedFade(ghost, shown, GHOST_FADE);

  return (
    <button
      ref={ghost}
      type="button"
      data-slot="waveform-ghost"
      data-shown={shown ? "" : undefined}
      data-on={open ? "" : undefined}
      // Placeholder copy (E's).
      aria-label="Show waveform controls"
      aria-expanded={open}
      aria-controls={panelId}
      onClick={() => dispatch({ type: "toggle" })}
      onFocus={() => dispatch({ type: "focus", to: "ghost" })}
      onBlur={() => dispatch({ type: "focus", to: null })}
      className={cn(
        "border-ramp-4 text-ramp-8 font-ui absolute top-[calc(100%+1.5rem)] left-[calc(50%-0.875rem)] flex size-7 items-center justify-center border text-sm/4 font-medium",
        "data-on:border-ramp-6 data-on:bg-ramp-3 data-on:text-ramp-10",
        "before:absolute before:inset-x-0 before:bottom-full before:h-6",
        "focus-visible:outline-signal outline-none focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-solid"
      )}
    >
      ?
    </button>
  );
}

/** The key map at the top of the rail. Mounted on Home for its transitions; inert while closed. */
export function WaveformControls({
  controls,
}: {
  readonly controls: WaveformControlsApi;
}) {
  const { state, dispatch, panel, panelId, pageKeys, setPageKeys } = controls;
  const { config } = useWaveformConfig();
  const headingId = useId();
  const open = state.panel.kind === "open";
  const mark = state.panel.kind === "open" ? state.panel.mark : null;

  useReducedFade(panel, open, CONTROLS_FADE);

  return (
    <div
      data-slot="waveform-controls-frame"
      data-open={open ? "" : undefined}
      inert={!open}
    >
      {/* The row's clip is E's inset(0 0 100% 0) to inset(0) reveal. */}
      <div className="min-h-0 overflow-clip">
        <section
          ref={panel}
          id={panelId}
          data-slot="waveform-controls"
          aria-labelledby={headingId}
          className="flex flex-col"
          onFocus={() => dispatch({ type: "focus", to: "controls" })}
          onBlur={({ currentTarget, relatedTarget }) => {
            if (!currentTarget.contains(relatedTarget))
              dispatch({ type: "focus", to: null });
          }}
        >
          <div className="flex h-6 items-center gap-2">
            <h2 id={headingId} className="type-label text-ramp-10 flex-1">
              Waveform controls
            </h2>
            <button
              type="button"
              // Placeholder copy (E's).
              aria-label="Close waveform controls"
              onClick={() => dispatch({ type: "close" })}
              className="text-ramp-8 hover:text-ramp-10 focus-visible:outline-signal flex size-6 items-center justify-end outline-none focus-visible:outline-1 focus-visible:-outline-offset-1 focus-visible:outline-solid"
            >
              <svg
                width="12"
                height="12"
                viewBox="0 0 12 12"
                aria-hidden="true"
                fill="none"
              >
                <path
                  d="M2 2L10 10M10 2L2 10"
                  stroke="currentColor"
                  strokeWidth="1.2"
                  strokeLinecap="square"
                />
              </svg>
            </button>
          </div>
          <dl className="flex flex-col pt-3">
            {CONTROL_ROWS.map((row, index) => {
              const marked = mark?.row === index ? mark : null;
              const value = marked && row.value?.(config);

              return (
                <div key={row.label} className="flex h-6 items-center gap-3">
                  <dt
                    className={cn(
                      "role-mono-sm flex-1",
                      marked ? "text-ramp-10" : "text-ramp-8"
                    )}
                  >
                    {row.label}
                  </dt>
                  <dd className="flex items-center gap-3">
                    {value ? (
                      // Phosphor while fresh, then ink 8 (app/globals.css).
                      <span
                        data-slot="waveform-value"
                        data-fresh={marked.fresh ? "" : undefined}
                        className="role-mono-sm text-ramp-8 data-fresh:text-signal"
                      >
                        {value}
                      </span>
                    ) : null}
                    <span className="flex w-20 justify-end gap-1">
                      {row.caps.map((cap, capIndex) => (
                        // E's caps, with a pressed state the Kevelle Kbd doesn't have.
                        <kbd
                          key={cap.text}
                          data-pressed={
                            state.held.some(
                              (held) =>
                                held.row === index && held.cap === capIndex
                            )
                              ? ""
                              : undefined
                          }
                          className="type-pixel bg-ramp-3 text-ramp-9 data-pressed:bg-ramp-10 data-pressed:text-ramp-1 flex h-5 min-w-5 items-center justify-center px-1.5"
                        >
                          {cap.text}
                        </kbd>
                      ))}
                    </span>
                  </dd>
                </div>
              );
            })}
          </dl>
          {/* pr-0.5 keeps the switch's 2px focus ring inside the rail, which clips. */}
          <label className="role-mono-sm text-ramp-8 mt-3 flex h-6 items-center justify-between pr-0.5">
            {COPY.pageKeys}
            <Switch
              size="sm"
              checked={pageKeys}
              onCheckedChange={setPageKeys}
            />
          </label>
        </section>
      </div>
    </div>
  );
}
