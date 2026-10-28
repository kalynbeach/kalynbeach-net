import type { SiteEntry } from "@/lib/site";

/**
 * The desktop layout's media query, for code that must react to it in
 * JavaScript. It mirrors --breakpoint-desktop in app/globals.css, and
 * tests/layout.test.ts fails when the two drift apart.
 */
export const desktopMedia = "(width >= 68.75rem)";

/** Three sections at 1100px and up; the top bar, sheet and player bar below. */
export type Layout = "desktop" | "narrow";

/** The player views that draw the frame, view-transition name `wave-player`. The Library has none. */
export type Frame = "card" | "mini" | "bar";

/**
 * Who holds the live canvas (view-transition name `waveform`) and which
 * frame is on screen. One field each, so a page can't show two frames or
 * two live holders. The union also rules out a screen slot without a frame,
 * and a stage beside a screen slot, which would leave one of them an empty
 * box since the newest slot holds the canvas.
 */
export type Holder =
  /** Home. A frame here draws the block's still figure; the stage keeps the canvas. No mark. */
  | {
      readonly live: "stage";
      readonly frame: "mini" | "bar" | null;
      readonly mark: null;
    }
  /** The frame's screen slot holds the canvas, paused included. */
  | {
      readonly live: "screen";
      readonly frame: Frame;
      readonly mark: Layout | null;
    }
  /** No slot. The engine lends `waveform` to the mark. */
  | {
      readonly live: null;
      readonly frame: "card" | null;
      readonly mark: Layout | null;
    };

export type Placement = Holder & {
  /**
   * The glow at 1100px and up: present where the site map turns it on, and
   * absent elsewhere so it fades out. null below 1100px and before the layout
   * is known, where the glow has no canvas at all.
   */
  readonly glow: boolean | null;
  /** Music's Library: section 3 at 1100px and up, below section 1 under it. */
  readonly library: boolean;
};

/**
 * Where the live waveform, the static mark, the glow and the player's one
 * frame go. The shell renders these from what this returns and decides
 * none of them itself.
 *
 * `active` is useWavePlayer().active: true from the first play until the
 * last track ends, pauses included. `layout` is null on the server and
 * through hydration; until it is known nothing that depends on it renders
 * (the mark, the mini player, the bar, the glow), so nothing has to unmount
 * once it is. `mark` names the Identity that draws the static mark, since
 * the engine lends `waveform` to the newest mark even when CSS hides it.
 */
export function place(
  entry: SiteEntry,
  active: boolean,
  layout: Layout | null
): Placement {
  const follower =
    layout === "desktop" ? "mini" : layout === "narrow" ? "bar" : null;

  if (entry.kind === "stage") {
    return {
      live: "stage",
      frame: active ? follower : null,
      mark: null,
      glow: layout === "desktop" ? false : null,
      library: false,
    };
  }

  const page = {
    mark: layout,
    glow: layout === "desktop" ? entry.glow : null,
    library: entry.player === "full",
  };

  switch (entry.player) {
    case "full":
      return { ...page, live: active ? "screen" : null, frame: "card" };
    case "follow":
      return active && follower
        ? { ...page, live: "screen", frame: follower }
        : { ...page, live: null, frame: null };
    case null:
      return { ...page, live: null, frame: null };
  }
}
