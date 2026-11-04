import type { SiteEntry } from "@/lib/site";

/**
 * The desktop layout's media query, for code that must react to it in
 * JavaScript. It mirrors --breakpoint-desktop in app/globals.css, and
 * tests/layout.test.ts fails when the two drift apart.
 */
export const desktopMedia = "(width >= 75rem)";

/** The three sections at 1200px and up; the top bar, sheet and player bar below. */
export type Layout = "desktop" | "narrow";

/** The player views that draw the frame, view-transition name `wave-player`. The Library has none. */
export type Frame = "card" | "mini" | "bar";

/**
 * What the shell draws around a page: whether Home's stage is on screen,
 * the player's one frame, and which Identity draws the mark. One field
 * each, so a page can't show two frames.
 *
 * The site's waveform lives on the stage and in the mark and never enters
 * a player view: the player draws its own waveform in its frames. The
 * union keeps the stage the page's one live figure. On Home a frame draws
 * the player's still (live={false}) and the card never shows. Elsewhere a
 * frame draws the player's live screen. The mark draws on every page but
 * Home, where the stage is the figure. It has a canvas of its own and takes
 * the waveform's view-transition name while no stage holds the live figure,
 * so leaving Home morphs the stage into the mark, and coming back morphs
 * the mark into the stage.
 */
export type Placement =
  | {
      readonly stage: true;
      readonly frame: "mini" | "bar" | null;
      readonly mark: null;
    }
  | {
      readonly stage: false;
      readonly frame: Frame | null;
      readonly mark: Layout | null;
    };

/**
 * Where the stage, the static mark and the player's one frame go. The
 * shell renders these from what this returns and decides none of them
 * itself. The card brings the Library with it.
 *
 * `active` is useWavePlayer().active: from the first play until the last
 * track ends, pauses included. The card stays on Music whatever playback
 * does, while the mini player and the bar follow only while it is active.
 * `layout` is null on the server and through hydration; until it is known
 * nothing that depends on it renders (the mark, the mini player, the bar),
 * so nothing has to unmount once it is. `mark` names the Identity that
 * draws the mark, since the engine lends `waveform` to the newest mark even
 * when CSS hides it.
 */
export function place(
  entry: SiteEntry,
  active: boolean,
  layout: Layout | null
): Placement {
  const follower = active && layout ? followers[layout] : null;

  switch (entry.kind) {
    case "stage":
      return { stage: true, frame: follower, mark: null };
    case "wide":
      return { stage: false, frame: null, mark: layout };
    case "page":
      switch (entry.player) {
        case "full":
          return { stage: false, frame: "card", mark: layout };
        case "follow":
          return { stage: false, frame: follower, mark: layout };
        case null:
          return { stage: false, frame: null, mark: layout };
      }
  }
}

/** The frame that follows the visitor off Music while playback is active. */
const followers = {
  desktop: "mini",
  narrow: "bar",
} as const satisfies Record<Layout, Frame>;
