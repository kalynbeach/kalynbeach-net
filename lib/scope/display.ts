import type { Frame, SampleWindow } from "@/lib/audio";
import { toFrame } from "@/lib/audio";
import type { FrameWriter } from "@/lib/phosphor";

import type { XySettings, YtSettings } from "./settings";
import { SWEEP_DIVISIONS } from "./settings";

export type DisplayInput = {
  /**
   * Holds [window.start, to). window.start is at most `from`, and earlier by
   * up to lookback() frames when the feed still held them. A display never
   * reads before window.start.
   */
  readonly window: SampleWindow;
  /** First new frame. */
  readonly from: Frame;
  /** One past the last new frame. */
  readonly to: Frame;
  readonly sampleRate: number;
  /** False after a gap, a feed switch, or an unfreeze: start a new strip, join nothing. */
  readonly continuous: boolean;
  /**
   * The feed carries one signal: a one-channel window, or two channels where
   * the right is silent or equals the left (FeedLayout "mono"). XY draws it
   * as a delay plot from the left channel.
   */
  readonly mono: boolean;
  /** Display gain per channel, from ScaleSettings. Applied before clamping to ±1. */
  readonly gain: readonly [number, number];
  /** Canvas width in device pixels. YT decimates to it. */
  readonly columns: number;
};

export type TriggerStatus = "armed" | "triggered" | "auto" | "stopped";

export type DisplayReport = {
  readonly trigger: TriggerStatus | null;
  /** True when this frame drew min and max per column instead of every frame. */
  readonly decimated: boolean;
  /** Single mode finished its sweep this frame. */
  readonly singleDone: boolean;
};

export interface Display<Settings> {
  /** Frames before `from` that advance() may read: the XY delay or the YT pretrigger. */
  lookback(settings: Settings, sampleRate: number): number;
  /**
   * Draws frames [from, to). A settings object that differs (by identity)
   * from the previous call's resets the display first, so a mode, axis, or
   * timebase change starts a fresh trace instead of bending the old one.
   */
  advance(
    input: DisplayInput,
    settings: Settings,
    out: FrameWriter
  ): DisplayReport;
  /** Forgets the last point and the sweep in progress, and re-arms the trigger. */
  reset(): void;
}

/**
 * Geometry, per frame f, with g the gain and every value clamped to ±1:
 *   stereo, "lr": x = L[f] g0, y = R[f] g1
 *   stereo, "ms": x = (R[f] - L[f]) g0 / 2, y = (L[f] + R[f]) g1 / 2
 *   mono input:   x = L[f] g0, y = L[f - delay] g0, a delay plot; frames
 *                 whose delayed sample is before window.start are skipped
 * Writes pointDuration(1 / sampleRate), then strip(0), then the last point of
 * the previous call when `continuous`, then one point per frame.
 * lookback conservatively reserves round(delay × sampleRate), since the
 * layout is known only when advance receives its window.
 */
export function createXyDisplay(): Display<XySettings> {
  let previous: XySettings | null = null;
  let last: readonly [number, number] | null = null;

  return {
    lookback: (settings, sampleRate) => Math.round(settings.delay * sampleRate),
    reset() {
      previous = null;
      last = null;
    },
    advance(input, settings, out) {
      if (settings !== previous || !input.continuous) last = null;

      previous = settings;
      const { window, gain, sampleRate, mono } = input;
      const delay = Math.round(settings.delay * sampleRate);

      const from = Math.max(input.from, window.start + (mono ? delay : 0));

      const to = Math.min(input.to, window.start + window.length);

      if (from < to) {
        out.pointDuration(1 / sampleRate);
        out.strip(0);

        if (last) out.point(last[0], last[1]);

        for (let frame = from; frame < to; frame += 1) {
          const index = frame - window.start;
          const left = window.left[index];
          const right = window.right[index];

          const x =
            mono || settings.axes === "lr"
              ? left * gain[0]
              : ((right - left) * gain[0]) / 2;

          const y = mono
            ? window.left[index - delay] * gain[0]
            : settings.axes === "lr"
              ? right * gain[1]
              : ((left + right) * gain[1]) / 2;

          last = [clip(x), clip(y)];
          out.point(last[0], last[1]);
        }
      }

      return { trigger: null, decimated: false, singleDone: false };
    },
  };
}

function clip(value: number): number {
  return Math.min(1, Math.max(-1, value));
}

/**
 * The sweep's state between animation frames. Each variant holds only what
 * its phase needs, so a sweep without a start frame can't exist.
 */
export type SweepState =
  | {
      readonly phase: "armed";
      /** Next frame to scan. Never earlier than the previous sweep's end plus the pretrigger, so windows stay disjoint. */
      readonly scanFrom: Frame;
      /** When arming began; auto mode free-runs after max(2 sweeps, 50 ms) without a trigger. */
      readonly since: Frame;
      /** Hysteresis: the trigger channel has been past the level by 2% on the far side since arming. */
      readonly primed: boolean;
    }
  | {
      readonly phase: "sweeping";
      readonly start: Frame;
      readonly end: Frame;
      /** Next frame to draw. */
      readonly drawnUntil: Frame;
      readonly cause: "trigger" | "auto";
    }
  | { readonly phase: "holdoff"; readonly until: Frame }
  | { readonly phase: "done" };

/** Above this many frames per column, YT emits min and max per column. */
export const DECIMATE_ABOVE = 2;

/**
 * sweepFrames = round(timebase × SWEEP_DIVISIONS × sampleRate);
 * pre = round(pretrigger × sweepFrames); hold = round(holdoff × sampleRate).
 * Loop until the range [from, to) is consumed:
 *   armed: scan [max(scanFrom, from), to) on the trigger channel (L when the
 *     window is mono) for a crossing of level in the slope's direction, with
 *     2% of full scale hysteresis, after gain. At crossing frame t:
 *       sweeping(start = t - pre, end = start + sweepFrames, drawnUntil = start, cause "trigger").
 *     Mode "auto" with no crossing once to - since > max(2 × sweepFrames,
 *     0.05 s): sweeping(start = the frame the wait ran out, cause "auto"),
 *     which needs no lookback. Otherwise scanFrom = to; stop.
 *   sweeping: draw [max(drawnUntil, window.start), min(end, to)) with
 *     x = -1 + 2 (f - start) / sweepFrames. Each visible channel is its own
 *     strip (trace 0 is CH1, trace 1 is CH2) and joins its own previous point
 *     within the sweep. When sweepFrames / columns > DECIMATE_ABOVE, a column
 *     emits its min and max in time order, each with pointDuration set to
 *     the beam time since the previous emitted point, carrying a partial
 *     column across animation frames and flushing it at the sweep's end.
 *     At end: single -> done; else holdoff(until = end + hold).
 *   holdoff: until <= to -> armed(scanFrom = until + pre, since = until); else stop.
 *   done: stop; trigger "stopped".
 * report.trigger: "armed" while waiting, "triggered" after a triggered sweep,
 * "auto" after a free-run sweep, "stopped" when done. singleDone is true only
 * on the call that reached done.
 * lookback = pre, so a trigger near `from` still has its pretrigger frames
 * when the feed holds them.
 * A gap abandons an incomplete sweep and re-arms, without joining across it.
 * A completed single sweep stays stopped through gaps until reset.
 * Repeated joining points carry zero time. The first visible sample carries
 * one sample period, and the last sample is emitted even when it is not an
 * extremum, so the durations cover every visible sample's beam time.
 */
export function createSweepDisplay(): Display<YtSettings> {
  type Point = { frame: number; value: number };

  type Column = { index: number; min: Point; max: Point; last: Point };

  type Trace = {
    last: Point | null;
    column: Column | null;
    open: boolean;
    first: number | null;
  };

  const traces: readonly [Trace, Trace] = [
    { last: null, column: null, open: false, first: null },
    { last: null, column: null, open: false, first: null },
  ];

  let state: SweepState | null = null;
  let previous: YtSettings | null = null;
  let triggerPrevious: Point | null = null;
  let columns = 1;

  function clearTraces() {
    for (const trace of traces) {
      trace.last = null;
      trace.column = null;
      trace.open = false;
      trace.first = null;
    }
  }

  function reset() {
    state = null;
    previous = null;
    triggerPrevious = null;
    clearTraces();
  }

  return {
    reset,
    lookback: (settings, sampleRate) =>
      Math.round(
        settings.pretrigger *
          Math.max(
            1,
            Math.round(settings.timebase * SWEEP_DIVISIONS * sampleRate)
          )
      ),
    advance(input, settings, out) {
      if (
        settings !== previous ||
        (!input.continuous && state?.phase !== "done")
      )
        reset();

      previous = settings;

      for (const trace of traces) trace.open = false;

      const { window, sampleRate } = input;
      const from = Math.max(input.from, window.start);
      const to = Math.min(input.to, window.start + window.length);

      const sweepFrames = Math.max(
        1,
        Math.round(settings.timebase * SWEEP_DIVISIONS * sampleRate)
      );

      const pre = Math.round(settings.pretrigger * sweepFrames);
      const hold = Math.round(settings.holdoff * sampleRate);
      const wait = Math.max(2 * sweepFrames, Math.ceil(0.05 * sampleRate));
      let trigger: TriggerStatus = "armed";
      let decimated = false;
      let singleDone = false;

      state ??= {
        phase: "armed",
        scanFrom: toFrame(from),
        since: toFrame(from),
        primed: false,
      };

      while (true) {
        if (state.phase === "done") {
          trigger = "stopped";
          break;
        }

        if (state.phase === "holdoff") {
          if (state.until > to) break;

          state = {
            phase: "armed",
            scanFrom: toFrame(state.until + pre),
            since: state.until,
            primed: false,
          };
          triggerPrevious = null;
        }

        if (state.phase === "armed") {
          const armed: Extract<SweepState, { phase: "armed" }> = state;
          let primed = armed.primed;
          let found: { frame: number; cause: "trigger" | "auto" } | null = null;

          for (
            let frame = Math.max(armed.scanFrom, from);
            frame < to;
            frame += 1
          ) {
            const channel =
              window.channels === 1 ? 0 : settings.trigger.channel;
            const samples = channel === 0 ? window.left : window.right;

            const sign = settings.trigger.slope === "rising" ? 1 : -1;

            const value =
              sign *
              (samples[frame - window.start] * input.gain[channel] -
                settings.trigger.level);

            const before =
              triggerPrevious?.frame === frame - 1
                ? triggerPrevious.value
                : frame > window.start
                  ? sign *
                    (samples[frame - 1 - window.start] * input.gain[channel] -
                      settings.trigger.level)
                  : null;

            if (value <= -0.02 || (before !== null && before <= -0.02))
              primed = true;

            triggerPrevious = { frame, value };

            if (primed && value >= 0 && before !== null && before < 0) {
              found = { frame, cause: "trigger" };
              break;
            }

            if (
              settings.trigger.mode === "auto" &&
              frame >= armed.since + wait
            ) {
              found = { frame: armed.since + wait, cause: "auto" };
              break;
            }
          }

          if (!found) {
            // A holdoff can arm past `to`; scanning never moves back before it.
            state = {
              ...armed,
              scanFrom: toFrame(Math.max(armed.scanFrom, to)),
              primed,
            };
            break;
          }

          const start: number =
            found.cause === "trigger" ? found.frame - pre : found.frame;

          state = {
            phase: "sweeping",
            start: toFrame(start),
            end: toFrame(start + sweepFrames),
            drawnUntil: toFrame(start),
            cause: found.cause,
          };
          columns = Math.max(1, Math.floor(input.columns));
          clearTraces();
        }

        if (state.phase === "sweeping") {
          const sweep: Extract<SweepState, { phase: "sweeping" }> = state;
          const begin = Math.max(sweep.drawnUntil, window.start);
          const end = Math.min(sweep.end, to);
          const compressed = sweepFrames / columns > DECIMATE_ABOVE;

          trigger = sweep.cause === "trigger" ? "triggered" : "auto";
          decimated ||= compressed && begin < end;

          for (const channel of [0, 1] as const) {
            if (channel === 1 && window.channels === 1) continue;

            if (
              settings.channels !== "both" &&
              settings.channels !== String(channel + 1)
            )
              continue;

            const trace = traces[channel];
            const samples = channel === 0 ? window.left : window.right;

            if (begin < end) trace.first ??= begin;

            const emit = (point: Point) => {
              if (!trace.open) {
                out.strip(channel);

                if (trace.last) {
                  out.pointDuration(0);
                  out.point(
                    -1 + (2 * (trace.last.frame - sweep.start)) / sweepFrames,
                    trace.last.value
                  );
                }

                trace.open = true;
              }

              out.pointDuration(
                (point.frame -
                  (trace.last?.frame ?? (trace.first ?? begin) - 1)) /
                  sampleRate
              );
              out.point(
                -1 + (2 * (point.frame - sweep.start)) / sweepFrames,
                point.value
              );
              trace.last = point;
            };

            const flush = () => {
              const column = trace.column;

              if (!column) return;

              if (column.min.frame <= column.max.frame) {
                emit(column.min);

                if (column.max.frame !== column.min.frame) emit(column.max);
              } else {
                emit(column.max);
                emit(column.min);
              }

              trace.column = null;
            };

            for (let frame = begin; frame < end; frame += 1) {
              const point = {
                frame,
                value: clip(
                  samples[frame - window.start] * input.gain[channel]
                ),
              };

              if (!compressed) {
                emit(point);
                continue;
              }

              const index = Math.floor(
                ((frame - sweep.start) * columns) / sweepFrames
              );

              if (trace.column && trace.column.index !== index) flush();

              if (!trace.column)
                trace.column = { index, min: point, max: point, last: point };
              else {
                if (point.value < trace.column.min.value)
                  trace.column.min = point;

                if (point.value > trace.column.max.value)
                  trace.column.max = point;
                trace.column.last = point;
              }
            }

            if (end === sweep.end) {
              const last = trace.column?.last;

              flush();

              if (last && trace.last?.frame !== last.frame) emit(last);
            }
          }

          state = { ...sweep, drawnUntil: toFrame(end) };

          if (end < sweep.end) break;

          if (settings.trigger.mode === "single") {
            state = { phase: "done" };
            singleDone = true;
          } else state = { phase: "holdoff", until: toFrame(sweep.end + hold) };
        }
      }

      return { trigger, decimated, singleDone };
    },
  };
}
