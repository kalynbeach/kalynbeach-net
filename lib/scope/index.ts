export { createScopeProducer } from "./producer";

/*
 * kevelle/scope: an oscilloscope's path from a sample feed to a phosphor
 * screen. It reads a kevelle/audio feed, draws the signal into a
 * kevelle/phosphor screen as an XY figure or a triggered YT sweep, and
 * measures it for a readout.
 *
 * Import from this file only. Framework-free: no React, no DOM, no GPU. The
 * Oscilloscope block draws with it, and any block that wants the same
 * figures can too.
 *
 * Usage. createScopeProducer({ getFeed, settings, frozen, onSingleDone,
 * budget }) returns { produce, readout }. Give produce to a phosphor screen
 * as its producer. Each frame it reads the feed from getFeed() and a
 * DisplaySettings from settings(), and draws every sample the listener has
 * heard since the last frame. budget() caps that at a number of samples,
 * MAX_POINTS by default, all a screen holds. DEFAULT_DISPLAY is XY on L/R,
 * a starting point for a block's own settings. Keep settings().xy and
 * settings().yt the same objects until they change, because a new object
 * resets its display and starts a fresh trace. While frozen() is true,
 * produce returns "hold". A YT sweep in "single" mode calls onSingleDone()
 * when it finishes and stays stopped until a resync or a new settings().yt
 * re-arms it. readout() returns the readings, the trigger status, the
 * feed's clock and layout, and the decimated flag described under Gaps, or
 * null until a feed has drawn. Poll it four times a second.
 *
 * Gain. The meter reads every sample raw, before gain. ScaleSettings "fixed"
 * multiplies by its gain. "auto" takes autoGain() of the held peak, which
 * decays with a 2 s time constant. It lifts a quiet signal toward 0.9 of full
 * scale and never attenuates, so full-scale tones draw at gain 1.
 *
 * Resync. A new feed, such as live audio replacing the silent preview, a
 * mode change, and frozen() turning false each reset the producer. It moves
 * its cursor to the frame heard now, reads no backlog, and draws nothing
 * that frame. The caller never has to signal these. A null feed draws
 * nothing, so the afterglow fades, and it is not a resync. When the same
 * feed comes back, the producer draws the samples it missed, up to the
 * budget.
 *
 * Gaps. The producer reads the feed through its own FeedCursor, every sample
 * once and one gap-free run at a time. A run that does not join the previous
 * one, after a dropped chunk, a ring wrap, or a backlog past the budget,
 * starts a new strip, so the beam never draws a line across a gap. A skipped
 * backlog sets readout().decimated for half a second, and so does a YT sweep
 * that drew one minimum and maximum per pixel column.
 *
 * Parts. createXyDisplay() and createSweepDisplay() are the two geometries,
 * for a caller that runs its own loop. Each keeps state across animation
 * frames, so give each screen its own. ./display.ts has the geometry and the
 * trigger rules. createMeter() measures each channel's frequency, peak, RMS,
 * and peak to peak, the X:Y ratio, and the correlation. formatReading()
 * prints a reading in the readout's units. ./measure.ts defines each
 * measurement.
 */

export type { ScopeProducer, ScopeReadout } from "./producer";

export { createSweepDisplay, createXyDisplay } from "./display";

export type {
  Display,
  DisplayInput,
  DisplayReport,
  TriggerStatus,
} from "./display";

export { autoGain, createMeter, formatReading } from "./measure";

export type { ChannelReading, Meter, Readings } from "./measure";

export {
  DEFAULT_DISPLAY,
  DISPLAY_LIMITS,
  SWEEP_DIVISIONS,
  TIMEBASES,
} from "./settings";

export type {
  DisplaySettings,
  ScaleSettings,
  Timebase,
  TriggerSettings,
  XySettings,
  YtSettings,
} from "./settings";
