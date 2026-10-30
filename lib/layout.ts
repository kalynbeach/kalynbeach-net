import type { SiteEntry } from "@/lib/site";

/**
 * The desktop layout's media query, for code that must react to it in
 * JavaScript. It mirrors --breakpoint-desktop in app/globals.css, and
 * tests/layout.test.ts fails when the two drift apart.
 */
export const desktopMedia = "(width >= 68.75rem)";

/** The sidebar and section 1 at 1100px and up; the top bar, sheet and player bar below. */
export type Layout = "desktop" | "narrow";

/** The player views that draw the frame, view-transition name `wave-player`. The Library has none. */
export type Frame = "card" | "mini" | "bar";

/**
 * Where playback stands. idle: nothing has played yet. active:
 * useWavePlayer().active, from the first play until the last track ends,
 * pauses included. ended: the last track ended and stays current, until
 * Replay or another track makes playback active again.
 */
export type Playback = "idle" | "active" | "ended";

/**
 * Who holds the live canvas (view-transition name `waveform`), which frame
 * is on screen, and which Identity draws the static mark. One field each, so
 * a page can't show two frames or two live holders. The union also rules
 * out a screen slot without a frame, and a stage beside a screen slot, which
 * would leave one of them an empty box since the newest slot holds the
 * canvas.
 */
export type Placement =
  /** Home. A frame here draws the block's still figure; the stage keeps the canvas. */
  | {
      readonly live: "stage";
      readonly frame: "mini" | "bar" | null;
      readonly mark: null;
    }
  | {
      readonly live: "screen";
      readonly frame: Frame;
      readonly mark: Layout | null;
    }
  /** The engine lends `waveform` to the mark. */
  | {
      readonly live: null;
      readonly frame: "card" | null;
      readonly mark: Layout | null;
    };

/**
 * Where the live waveform, the static mark and the player's one frame go.
 * The shell renders these from what this returns and decides none of them
 * itself. The card brings the Library with it.
 *
 * Once playback starts, the card holds the live waveform, ended included,
 * while the mini player and the bar leave when playback ends. `layout` is
 * null on the server and through hydration; until it is known nothing that
 * depends on it renders (the mark, the mini player, the bar), so nothing has
 * to unmount once it is. `mark` names the Identity that draws the static
 * mark, since the engine lends `waveform` to the newest mark even when CSS
 * hides it.
 */
export function place(
  entry: SiteEntry,
  playback: Playback,
  layout: Layout | null
): Placement {
  const active = playback === "active";
  const follower =
    layout === "desktop" ? "mini" : layout === "narrow" ? "bar" : null;

  switch (entry.kind) {
    case "stage":
      return { live: "stage", frame: active ? follower : null, mark: null };
    case "wide":
      return { live: null, frame: null, mark: layout };
    case "page":
      switch (entry.player) {
        case "full":
          return {
            live: playback === "idle" ? null : "screen",
            frame: "card",
            mark: layout,
          };
        case "follow":
          return active && follower
            ? { live: "screen", frame: follower, mark: layout }
            : { live: null, frame: null, mark: layout };
        case null:
          return { live: null, frame: null, mark: layout };
      }
  }
}
