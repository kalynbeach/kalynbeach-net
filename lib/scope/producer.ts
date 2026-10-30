import type {
  FeedCursor,
  FeedLayout,
  SampleFeed,
  SampleWindow,
} from "@/lib/audio";
import { createFeedCursor, createSampleWindow } from "@/lib/audio";
import type { FrameWriter, Producer } from "@/lib/phosphor";
import { MAX_POINTS } from "@/lib/phosphor";

import type { DisplayInput, DisplayReport, TriggerStatus } from "./display";
import { createSweepDisplay, createXyDisplay } from "./display";
import type { Readings } from "./measure";
import { autoGain, createMeter } from "./measure";
import type { DisplaySettings } from "./settings";

/** Longest lookback a display asks for: a 50 ms/div sweep's half pretrigger, with room for the XY delay. */
export const MAX_LOOKBACK_SECONDS = 0.26;

/** What the readout strip shows, polled by the caller four times a second. */
export type ScopeReadout = {
  readonly readings: Readings;
  /** YT only. */
  readonly trigger: TriggerStatus | null;
  /** A frame in the last half second drew min/max columns or skipped a backlog. */
  readonly decimated: boolean;
  /** The feed's clock at the last drawn frame, in seconds: the stage's timecode. */
  readonly clock: number;
  readonly layout: FeedLayout;
  readonly sampleRate: number;
};

export type ScopeProducer = {
  readonly produce: Producer;
  /** Null until a feed has drawn a frame. */
  readout(): ScopeReadout | null;
};

export function createScopeProducer(deps: {
  readonly getFeed: () => SampleFeed | null;
  readonly settings: () => DisplaySettings;
  readonly frozen: () => boolean;
  readonly onSingleDone: () => void;
  /**
   * The most frames one animation frame reads, which is the most points XY
   * writes. Defaults to MAX_POINTS, all the screen holds. A backlog past it
   * is skipped and breaks the trace.
   */
  readonly budget?: () => number;
}): ScopeProducer {
  const xy = createXyDisplay();
  const yt = createSweepDisplay();
  const meter = createMeter(48000);

  let reading: {
    readonly feed: SampleFeed;
    readonly cursor: FeedCursor;
    readonly window: SampleWindow;
  } | null = null;

  let mode: DisplaySettings["mode"] | null = null;
  let wasFrozen = false;
  let peak = 0;
  let decimatedUntil = -Infinity;
  let now = 0;
  // The live feed measures its layout over half a second of samples, so the
  // producer asks four times a second instead of every frame.
  let layout: FeedLayout = "stereo";
  let layoutAt = -Infinity;

  const advance = (
    input: DisplayInput,
    settings: DisplaySettings,
    out: FrameWriter
  ): DisplayReport =>
    settings.mode === "xy"
      ? xy.advance(input, settings.xy, out)
      : yt.advance(input, settings.yt, out);

  let last: {
    trigger: TriggerStatus | null;
    clock: number;
    layout: FeedLayout;
  } | null = null;

  return {
    produce(frame, out) {
      now = frame.now;

      if (deps.frozen()) {
        wasFrozen = true;

        return "hold";
      }

      const feed = deps.getFeed();

      if (!feed) return "draw";

      const settings = deps.settings();
      const target = feed.heardAt(frame.now);
      let resync = wasFrozen || mode !== settings.mode;

      if (reading?.feed !== feed) {
        reading = {
          feed,
          cursor: createFeedCursor(feed),
          window: createSampleWindow(
            MAX_POINTS + Math.ceil(MAX_LOOKBACK_SECONDS * feed.sampleRate)
          ),
        };
        meter.reset(feed.sampleRate);
        layoutAt = -Infinity;
        peak = 0;
        last = null;
        decimatedUntil = -Infinity;
        resync = true;
      }

      const { cursor, window } = reading;

      mode = settings.mode;
      wasFrozen = false;

      if (resync) {
        xy.reset();
        yt.reset();
        cursor.reset(target);

        return "draw";
      }

      const lookback =
        mode === "xy"
          ? xy.lookback(settings.xy, feed.sampleRate)
          : yt.lookback(settings.yt, feed.sampleRate);

      const budget = deps.budget?.() ?? MAX_POINTS;

      // advance() starts past the position when the ring or the budget cuts
      // the backlog short, so those frames never draw. A gap longer than the
      // budget counts too, because the start alone can't tell it apart.
      if (
        cursor.position !== null &&
        Math.max(feed.oldest(), target - budget) > cursor.position
      )
        decimatedUntil = frame.now + 500;

      if (frame.now - layoutAt >= 250) {
        layout = feed.layout();
        layoutAt = frame.now;
      }

      cursor.advance(
        target,
        window,
        (run) => {
          meter.push(run.window, run.from, run.to);
          peak = Math.max(meter.peak(), peak * Math.exp(-frame.dt / 2));

          const gain =
            settings.scale.kind === "fixed"
              ? settings.scale.gain
              : autoGain(peak);

          const report = advance(
            {
              window: run.window,
              from: run.from,
              to: run.to,
              sampleRate: feed.sampleRate,
              continuous: run.joined,
              mono: run.window.channels === 1 || layout === "mono",
              gain: [gain, gain],
              columns: frame.width,
            },
            settings,
            out
          );

          if (report.decimated) decimatedUntil = frame.now + 500;

          last = {
            trigger: report.trigger,
            clock: run.to / feed.sampleRate,
            layout,
          };

          if (report.singleDone) deps.onSingleDone();
        },
        { lookback, budget }
      );

      return "draw";
    },
    readout() {
      if (!reading || !last) return null;

      return {
        readings: meter.read(),
        trigger: last.trigger,
        decimated: now < decimatedUntil,
        clock: last.clock,
        layout: last.layout,
        sampleRate: reading.feed.sampleRate,
      };
    },
  };
}
