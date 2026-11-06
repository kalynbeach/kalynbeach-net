"use client";

/*
 * The thin progress line, Kevelle's Progress at size="sm": the bar's track
 * progress, and the line the mini player's seek slider draws. It follows the
 * playhead in steps of one device pixel, so it renders only when its fill
 * would move a pixel, and the indicator's width transition carries it
 * smoothly between steps.
 */

import { useEffect, useRef, useState, type RefObject } from "react";

import type { Seconds } from "@/lib/audio";
import { Progress } from "@/components/ui/progress";

import { seekValueText } from "./format";
import { usePlayhead, type Playhead } from "./playhead";

/** Before the first measurement and on the server: the 416px bar less the small Card's padding, at 2x. */
const FALLBACK_STEPS = 784;

export function ProgressLine({
  playhead,
  duration,
  preview = null,
  label,
}: {
  readonly playhead: Playhead;
  /** Null while the duration is unknown or after a failure, which leaves the line empty. */
  readonly duration: Seconds | null;
  /** A drag in progress, drawn in place of the position. */
  readonly preview?: number | null;
  /**
   * The progressbar's name, which also makes it speak the position as time.
   * Absent: the line is hidden from assistive technology, for a line under
   * a slider that speaks the position itself.
   */
  readonly label?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const steps = useDevicePixelWidth(ref);

  const value = usePlayhead(playhead, (position) =>
    duration
      ? (Math.round(Math.min(1, (preview ?? position) / duration) * steps) /
          steps) *
        100
      : 0
  );

  return (
    <div ref={ref} className="w-full">
      {label ? (
        <Progress
          size="sm"
          value={value}
          aria-label={label}
          getAriaValueText={() =>
            seekValueText(((duration ?? 0) * value) / 100, duration)
          }
        />
      ) : (
        <Progress size="sm" value={value} aria-hidden="true" />
      )}
    </div>
  );
}

function useDevicePixelWidth(ref: RefObject<HTMLElement | null>): number {
  const [steps, setSteps] = useState(FALLBACK_STEPS);

  useEffect(() => {
    const element = ref.current;

    if (!element) return;

    const observer = new ResizeObserver(([entry]) => {
      if (entry)
        setSteps(
          Math.max(1, Math.round(entry.contentRect.width * devicePixelRatio))
        );
    });

    observer.observe(element);

    return () => observer.disconnect();
  }, [ref]);

  return steps;
}
