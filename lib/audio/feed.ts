import { toFrame, type Frame } from "./units";
import {
  TAP_CHUNK_FRAMES,
  TAP_HEADER_LENGTH,
  TAP_PACKET_LENGTH,
} from "./worklet-source";

/**
 * A caller-owned buffer that read() fills. Allocate it once with
 * createSampleWindow() and reuse it every frame.
 *
 * Invariant: frames [start, start + length) are valid in `left`, and in
 * `right` when channels is 2. A mono window leaves `right` untouched.
 */
export type SampleWindow = {
  start: Frame;
  length: number;
  channels: 1 | 2;
  readonly left: Float32Array;
  readonly right: Float32Array;
};

/**
 * What the feed's samples carry. "mono" covers a one-channel source and a
 * two-channel source whose right channel is silent or equals the left, which
 * is what Safari and many built-in microphones deliver. An XY display labels
 * a mono feed and draws it as a delay plot.
 */
export type FeedLayout = "mono" | "stereo";

/** Transport counters, for diagnostics and the audio lab's drop check. */
export type FeedStats = {
  /** Tap packets delivered to the main thread. */
  readonly packets: number;
  /** Frames lost to an empty tap pool or discarded as overlapping packets. */
  readonly droppedFrames: number;
  /** Gap-free runs started, the first included. A drop, a paused tap, or a channel change starts one. */
  readonly runs: number;
};

export interface SampleFeed {
  /** Frames per second of this feed. Fixed for the feed's lifetime. */
  readonly sampleRate: number;
  /**
   * The frame boundary the listener has heard up to at `now`, a
   * requestAnimationFrame timestamp: every frame before it is audible. Never
   * later than the end of what the feed holds, so a reader that stops at
   * heardAt() never waits on missing data. Monotonic. Calling it marks the
   * feed active, like read().
   */
  heardAt(now: DOMHighResTimeStamp): Frame;
  /**
   * The oldest frame the feed still holds. A reader whose cursor is behind it
   * lost frames to the ring's wrap and must break its trace there.
   */
  oldest(): Frame;
  /**
   * Copies frames [from, to) into `into`, clamped to oldest() and to into's
   * capacity, without crossing a gap: the feed holds gap-free runs, and a
   * drop, a paused tap, or a channel change starts a new one. A read stops at
   * the end of the run it starts in, and a `from` in a gap starts at the next
   * run. into.start is the first frame actually copied, so into.start > from
   * marks a discontinuity. createFeedCursor() reads through these rules and
   * reports each run and each break, so a reader advances a cursor instead of
   * calling read() in its own loop. Reading marks the feed active, as
   * heardAt() does; a live feed nobody asks for 500 ms tells its tap to stop
   * posting until the next call.
   */
  read(from: Frame, to: Frame, into: SampleWindow): SampleWindow;
  /** Measured over the newest half second of signal. */
  layout(): FeedLayout;
  stats(): FeedStats;
}

/** Room for `capacity` frames per channel. */
export function createSampleWindow(capacity: number): SampleWindow {
  return {
    start: toFrame(0),
    length: 0,
    channels: 2,
    left: new Float32Array(capacity),
    right: new Float32Array(capacity),
  };
}

/** One gap-free stretch of a feed, handed to a reader by FeedCursor.advance(). */
export type FeedRun = {
  /** Holds frames [from, to), and with a lookback, frames before `from` too. */
  readonly window: SampleWindow;
  readonly from: Frame;
  readonly to: Frame;
  /**
   * True when the run starts exactly where the previous run ended since the
   * last reset(). A reader breaks its trace at a run that is not joined.
   */
  readonly joined: boolean;
};

/**
 * A reader's position in one feed. Each animation frame, advance it to
 * heardAt(now). It reads every frame from the position to the target once, in
 * order, one gap-free run at a time.
 */
export type FeedCursor = {
  /**
   * Every frame before the position was read or skipped. Null until the
   * first advance() or reset(at), and after reset() with no frame.
   */
  readonly position: Frame | null;
  /**
   * Reads up to `to`, calls `onRun` for each gap-free run, and returns the new
   * position. The position never moves backward and never passes `to`. A `to`
   * before the position throws RangeError.
   *
   * The read starts at max(position, oldest(), to - budget), so `budget` caps
   * the backlog one advance() reads. A null position starts at
   * max(oldest(), to - budget). The start never passes `to`, and a start past
   * the position skips frames and breaks the trace. `lookback` adds up to that
   * many frames before the position to the window, for a display that needs
   * history. The run still starts at the position. When the target lies in a
   * gap, the advance stops where the gap starts, and the next advance()
   * starts past the gap with a run that is not joined.
   */
  advance(
    to: Frame,
    window: SampleWindow,
    onRun: (run: FeedRun) => void,
    options?: { readonly lookback?: number; readonly budget?: number }
  ): Frame;
  /** Moves the position to `at`, or clears it, and breaks the trace. */
  reset(at?: Frame): void;
};

/** A new cursor over `feed`, with no position yet. Each reader holds its own. */
export function createFeedCursor(feed: SampleFeed): FeedCursor {
  let position: Frame | null = null;
  // Where the last run since reset() ended. A run that starts here is joined.
  let previousEnd: Frame | null = null;

  return {
    get position() {
      return position;
    },
    reset(at) {
      position = at ?? null;
      previousEnd = null;
    },
    advance(to, window, onRun, { lookback = 0, budget = Infinity } = {}) {
      if (position !== null && to < position)
        throw new RangeError(
          `target ${to} is before the cursor's position ${position}`
        );

      position = toFrame(
        Math.min(
          to,
          Math.max(
            position ?? feed.oldest(),
            feed.oldest(),
            to - Math.max(0, budget)
          )
        )
      );

      while (position < to) {
        let read = feed.read(
          toFrame(Math.max(feed.oldest(), position - Math.max(0, lookback))),
          to,
          window
        );

        // The lookback read ended at or before the position, because it
        // started in an earlier run or filled the window.
        if (read.start + read.length <= position)
          read = feed.read(position, to, window);

        if (read.length === 0) break;

        const from = toFrame(Math.max(position, read.start));
        const end = toFrame(Math.min(to, read.start + read.length));

        if (end <= from) break;

        onRun({ window: read, from, to: end, joined: from === previousEnd });
        position = end;
        previousEnd = end;
      }

      return position;
    },
  };
}

// ---------------------------------------------------------------------------
// Internal: the live feed and its tap receiver. Not exported from index.ts.

/** 2^17 frames per channel: 2.7 s at 48 kHz, enough for a 0.5 s sweep plus pretrigger at 96 kHz. */
export const RING_FRAMES = 131_072;

/** A live feed nobody reads for this long pauses its tap. */
const IDLE_MS = 500;

const LAYOUT_SECONDS = 0.5;

/** -80 dBFS RMS: a channel this quiet carries nothing. */
const SILENT_RMS = 1e-4;

/** -60 dBFS RMS: a channel this loud carries a signal. */
const SIGNAL_RMS = 1e-3;

/** -60 dB: an L - R peak this far under L's peak means the channels match. */
const SAME_SIGNAL = 1e-3;

/** The AudioContext members the output clock reads. A Pick so tests can pass a fake. */
export type ClockContext = Pick<
  AudioContext,
  | "sampleRate"
  | "currentTime"
  | "baseLatency"
  | "outputLatency"
  | "getOutputTimestamp"
>;

/**
 * Maps requestAnimationFrame time to the frame at the listener's ears:
 *   ts = context.getOutputTimestamp()
 *   heard = ts.contextTime + (now - ts.performanceTime) / 1000
 * When performanceTime is 0 or missing (before the first rendered block),
 * heard = currentTime - (outputLatency || 0) - baseLatency, since Safari
 * before 18.4 lacks outputLatency. The result is floored to a frame, kept
 * monotonic, and clamped to `end()`, the newest frame boundary delivered.
 */
export function createOutputClock(
  context: ClockContext,
  end: () => Frame
): (now: DOMHighResTimeStamp) => Frame {
  let heard = 0;

  return (now) => {
    const stamp = context.getOutputTimestamp();
    const performanceTime = stamp.performanceTime ?? 0;

    const seconds =
      performanceTime > 0
        ? (stamp.contextTime ?? 0) + (now - performanceTime) / 1000
        : context.currentTime -
          (context.outputLatency || 0) -
          (context.baseLatency || 0);

    const frame = Math.floor(seconds * context.sampleRate);

    // A NaN reading fails the comparison and keeps the previous frame.
    if (frame > heard) heard = frame;

    heard = Math.min(heard, end());

    return toFrame(heard);
  };
}

/** The receiving end of one tap node: its ring, clock, and feed. */
export type TapReceiver = {
  readonly feed: SampleFeed;
  /** Stops listening to the port and releases the ring. Idempotent. */
  dispose(): void;
};

/** A gap-free stretch of the ring: frames [start, end) with one channel count. */
type Run = { readonly start: number; end: number; readonly channels: 1 | 2 };

/** The packet header, parsed at the port: frame, channels, frames, dropped. */
function isTapPacket(data: unknown): data is Float64Array {
  return (
    data instanceof Float64Array &&
    data.length === TAP_PACKET_LENGTH &&
    Number.isInteger(data[0]) &&
    data[0] >= 0 &&
    (data[1] === 1 || data[1] === 2) &&
    Number.isInteger(data[2]) &&
    data[2] >= 1 &&
    data[2] <= TAP_CHUNK_FRAMES &&
    Number.isInteger(data[3]) &&
    data[3] >= 0
  );
}

/**
 * Wires a tap AudioWorkletNode's port to a ring and returns its live feed.
 * Each packet is parsed, copied into the ring, and transferred straight back
 * to the worklet's pool. `setTimer` defaults to setTimeout; tests inject one.
 */
export function connectTap(options: {
  readonly port: MessagePort;
  readonly context: ClockContext;
  readonly setTimer?: (callback: () => void, ms: number) => () => void;
}): TapReceiver {
  const { port, context } = options;

  const setTimer =
    options.setTimer ??
    ((callback: () => void, ms: number) => {
      const id = setTimeout(callback, ms);

      return () => clearTimeout(id);
    });

  const layoutFrames = Math.round(LAYOUT_SECONDS * context.sampleRate);
  let left = new Float32Array(RING_FRAMES);
  let right = new Float32Array(RING_FRAMES);
  /** Oldest first. A run whose frames have all been overwritten is pruned. */
  const runs: Run[] = [];
  let end = 0;
  let packets = 0;
  let droppedFrames = 0;
  let runCount = 0;
  let layout: FeedLayout = "stereo";
  let layoutEnd = -1;
  let active = true;
  let disposed = false;
  let cancelIdle = setTimer(pause, IDLE_MS);

  function pause() {
    active = false;
    port.postMessage(false);
  }

  /*
   * Any reader call keeps the tap posting. heardAt() counts as well as read():
   * a paused tap delivers nothing, so heardAt() stays at the ring's end and a
   * reader that reads only new frames would never call read() to wake it.
   */
  function touch() {
    if (disposed) return;

    if (!active) {
      active = true;
      port.postMessage(true);
    }

    cancelIdle();
    cancelIdle = setTimer(pause, IDLE_MS);
  }

  function oldest(): number {
    return runs.length === 0 ? 0 : Math.max(runs[0].start, end - RING_FRAMES);
  }

  function write(packet: Float64Array) {
    const frame = packet[0];
    const channels = packet[1] === 1 ? 1 : 2;
    const frames = packet[2];
    let run = runs.at(-1);

    if (
      run === undefined ||
      frame !== end ||
      packet[3] !== 0 ||
      channels !== run.channels
    ) {
      run = { start: frame, end: frame, channels };
      runs.push(run);
      runCount += 1;
    }

    let index = frame % RING_FRAMES;

    for (let offset = 0; offset < frames; offset += 1) {
      left[index] = packet[TAP_HEADER_LENGTH + offset];

      if (channels === 2)
        right[index] = packet[TAP_HEADER_LENGTH + TAP_CHUNK_FRAMES + offset];

      index = index + 1 === RING_FRAMES ? 0 : index + 1;
    }

    run.end = frame + frames;
    end = run.end;

    while (runs[0].end <= end - RING_FRAMES) runs.shift();
  }

  function onMessage(event: MessageEvent) {
    const packet = event.data;

    if (!isTapPacket(packet)) return;

    if (packet[0] < end) droppedFrames += packet[2];
    else write(packet);

    packets += 1;
    droppedFrames += packet[3];
    port.postMessage(packet, [packet.buffer]);
  }

  /*
   * Mono when the source has one channel, when its right channel is silent
   * under a live left, or when L - R is negligible next to L. Silence, or a
   * left too quiet to judge, keeps the previous answer.
   */
  function measureLayout(run: Run): FeedLayout | null {
    if (run.channels === 1) return "mono";

    const start = Math.max(run.start, end - RING_FRAMES, end - layoutFrames);
    const count = end - start;
    let leftEnergy = 0;
    let rightEnergy = 0;
    let leftPeak = 0;
    let differencePeak = 0;
    let index = start % RING_FRAMES;

    for (let offset = 0; offset < count; offset += 1) {
      const l = left[index];
      const r = right[index];
      leftEnergy += l * l;
      rightEnergy += r * r;
      leftPeak = Math.max(leftPeak, Math.abs(l));
      differencePeak = Math.max(differencePeak, Math.abs(l - r));
      index = index + 1 === RING_FRAMES ? 0 : index + 1;
    }

    const leftRms = Math.sqrt(leftEnergy / count);
    const rightRms = Math.sqrt(rightEnergy / count);

    if (rightRms < SILENT_RMS) return leftRms > SIGNAL_RMS ? "mono" : null;

    return differencePeak <= SAME_SIGNAL * leftPeak ? "mono" : "stereo";
  }

  port.addEventListener("message", onMessage);
  port.start();

  const clock = createOutputClock(context, () => toFrame(end));

  const feed: SampleFeed = {
    sampleRate: context.sampleRate,

    heardAt(now) {
      touch();

      return clock(now);
    },

    oldest: () => toFrame(oldest()),

    read(from, to, into) {
      touch();

      let start = Math.max(from, oldest());
      let run: Run | undefined;

      // The run holding `start`, or the next one when `start` is in a gap.
      for (const candidate of runs) {
        if (candidate.end > start) {
          run = candidate;
          break;
        }
      }

      if (run === undefined) {
        into.start = toFrame(start);
        into.length = 0;

        return into;
      }

      start = Math.max(start, run.start);

      const length = Math.max(
        0,
        Math.min(to, run.end, start + into.left.length) - start
      );

      const offset = start % RING_FRAMES;
      const first = Math.min(length, RING_FRAMES - offset);

      // At most two copies per channel: up to the ring's end, then from its start.
      into.left.set(left.subarray(offset, offset + first));

      if (first < length)
        into.left.set(left.subarray(0, length - first), first);

      if (run.channels === 2) {
        into.right.set(right.subarray(offset, offset + first));

        if (first < length)
          into.right.set(right.subarray(0, length - first), first);
      }

      into.start = toFrame(start);
      into.length = length;
      into.channels = run.channels;

      return into;
    },

    layout() {
      const run = runs.at(-1);

      if (run !== undefined && end !== layoutEnd) {
        layout = measureLayout(run) ?? layout;
        layoutEnd = end;
      }

      return layout;
    },

    stats: () => ({ packets, droppedFrames, runs: runCount }),
  };

  return {
    feed,

    dispose() {
      if (disposed) return;

      disposed = true;
      cancelIdle();
      port.removeEventListener("message", onMessage);
      port.postMessage(null);
      runs.length = 0;
      left = new Float32Array(0);
      right = new Float32Array(0);
    },
  };
}
