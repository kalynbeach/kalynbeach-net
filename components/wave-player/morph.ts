import type { ViewTransitionProps } from "react";

/** The views that draw the player's frame. The Library has none. */
export type FrameKind = "card" | "mini" | "bar";

/**
 * The frame's view-transition-name, fixed by the contract with the site.
 * kevelle/waveform names its canvas "waveform"; this block never does.
 */
export const FRAME_NAME = "wave-player";

type Motion = Required<Pick<ViewTransitionProps, "share" | "enter" | "exit">>;

/**
 * share: the browser's morph from the frame that leaves to the frame that
 * arrives, in one transition.
 *
 * The card has no enter or exit of its own. Without a partner it arrives and
 * leaves with its page, as the page's other content does.
 *
 * The mini player and the bar fade in and out. A host mounts them by
 * useWavePlayer().active, so they come and go while the page stays.
 */
const MOTION = {
  card: { share: "auto", enter: "none", exit: "none" },
  mini: { share: "auto", enter: "auto", exit: "auto" },
  bar: { share: "auto", enter: "auto", exit: "auto" },
} as const satisfies Record<FrameKind, Motion>;

const STILL = {
  share: "none",
  enter: "none",
  exit: "none",
} as const satisfies Motion;

export type FrameTransition = Pick<
  ViewTransitionProps,
  "name" | "default" | "share" | "enter" | "exit"
>;

/**
 * The props for one frame's <ViewTransition>.
 *
 * `default: "none"` turns off "update", so the frame never crossfades for its
 * own content changes or an unrelated transition, and every trigger it uses
 * is named explicitly. A "none" default with no `share` would silently stop
 * the morph.
 *
 * `morph: false` leaves the frame unnamed and still, for a page that shows
 * several frames at once. Reduced motion keeps the name, so the one-frame
 * rule and React's duplicate check behave the same under either preference,
 * and turns every trigger off, so React applies no name and the frame swaps
 * at once.
 */
export function frameTransition(
  kind: FrameKind,
  options: { readonly morph: boolean; readonly reduced: boolean }
): FrameTransition {
  return {
    name: options.morph ? FRAME_NAME : undefined,
    default: "none",
    ...(options.morph && !options.reduced ? MOTION[kind] : STILL),
  };
}
