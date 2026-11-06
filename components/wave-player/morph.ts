import type { ViewTransitionProps } from "react";

/** The views that draw the player's frame. The Library has none. */
export type FrameKind = "card" | "mini" | "bar";

/**
 * The frame's view-transition-name, fixed by the contract with the site.
 * kevelle/waveform names its canvas "waveform"; this block never does.
 */
export const FRAME_NAME = "wave-player";

/** The motion preference a frame mounted under. "unknown" is the server and hydration. */
export type MountMotion = "full" | "reduced" | "unknown";

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
 * Whether a frame renders a <ViewTransition> at all, decided once when it
 * mounts (#208). React starts a browser view transition for every
 * <ViewTransition> a transition commit places, whatever its triggers, so a
 * frame that mounts under reduced motion renders none, and so does a
 * specimen, which passes morph false. A frame the server rendered mounts as
 * "unknown" and wraps, so hydration matches the server's markup. The
 * answer never changes for a mounted frame, because a change of element
 * type would remount its view.
 */
export function frameWraps(morph: boolean, motion: MountMotion): boolean {
  return morph && motion !== "reduced";
}

/**
 * The props for a wrapping frame's <ViewTransition>, from the live
 * preference. `reduced` is true through hydration and whenever the system
 * asks, and turns every trigger off, so the frame swaps, appears, and
 * leaves at once. An exit or a share whose trigger is "none" starts nothing.
 *
 * `default: "none"` turns off "update", so the frame never crossfades for its
 * own content changes or an unrelated transition, and every trigger it uses
 * is named explicitly. A "none" default with no `share` would silently stop
 * the morph.
 */
export function frameTransition(
  kind: FrameKind,
  reduced: boolean
): FrameTransition {
  return {
    name: FRAME_NAME,
    default: "none",
    ...(reduced ? STILL : MOTION[kind]),
  };
}
