"use client";

/*
 * The bar for narrow screens, a floating surface like a popover. No seek
 * bar. The title wraps rather than truncates.
 */

import {
  useEffect,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react";
import { cn } from "cn";

import type { Seconds } from "@/lib/audio";
import { Progress } from "@/components/ui/progress";

import { seekValueText } from "./format";
import { usePlayhead, type Playhead } from "./playhead";
import { Clock } from "./readouts";
import { Screen } from "./screen";
import { ScreenOverlay, StatusBadge } from "./status";
import { STATUS_VIEW } from "./status-view";
import { PlayerRegion, Transport, type ViewInput } from "./transport";

export function MobileBarView({
  state,
  playhead,
  onCommand,
  screen,
  className,
}: ViewInput & {
  readonly screen?: ReactNode;
  /** Layout classes only: the site places the bar, such as fixed inset-x-3 bottom-8. */
  readonly className?: string;
}) {
  const current = state.current;
  const known = STATUS_VIEW[state.status.kind].times;
  const duration = current?.track.duration ?? null;

  return (
    <PlayerRegion
      state={state}
      onCommand={onCommand}
      className={cn(
        "flex w-full flex-col bg-popover text-popover-foreground shadow-float aura outline-none focus-visible:ring-2 focus-visible:ring-ring",
        className
      )}
    >
      <div className="flex min-h-14 items-center justify-between gap-3 py-2 pr-2 pl-5">
        <div className="flex min-w-0 items-center gap-3">
          <Screen
            size="bar"
            overlay={
              <ScreenOverlay
                state={state}
                onCommand={onCommand}
                fit="spinner"
              />
            }
          >
            {screen}
          </Screen>
          <div className="flex min-w-0 flex-col">
            <p className="type-heading-3">
              {current?.track.title ?? "No tracks"}
            </p>
            <div className="flex min-h-5 items-center gap-2">
              <Clock playhead={playhead} known={known} duration={duration} />
              <StatusBadge state={state} />
            </div>
          </div>
        </div>
        <Transport
          state={state}
          onCommand={onCommand}
          size="bar"
          className="shrink-0"
        />
      </div>
      <div className="px-5 pb-3">
        <TrackProgress playhead={playhead} duration={known ? duration : null} />
      </div>
    </PlayerRegion>
  );
}

/** Before the first measurement and on the server: the 416px frame less its padding, at 2x. */
const FALLBACK_STEPS = 752;

/**
 * The thin Progress, fed by the playhead in steps of one device pixel, so it
 * renders only when its fill would move a pixel and the indicator's width
 * transition carries it smoothly between steps.
 */
function TrackProgress({
  playhead,
  duration,
}: {
  readonly playhead: Playhead;
  readonly duration: Seconds | null;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const steps = useDevicePixelWidth(ref);

  const value = usePlayhead(playhead, (position) =>
    duration
      ? (Math.round(Math.min(1, position / duration) * steps) / steps) * 100
      : 0
  );

  return (
    <div ref={ref}>
      <Progress
        size="sm"
        value={value}
        aria-label="Track progress"
        getAriaValueText={() =>
          seekValueText(((duration ?? 0) * value) / 100, duration)
        }
      />
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
