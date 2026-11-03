"use client";

/*
 * The bar for narrow screens, on a small Kevelle Card with the card's plain
 * edge. One row holds the screen, the title over the time, and the
 * transport; the thin progress line runs under it. No seek bar. The title
 * wraps rather than truncates.
 */

import type { ReactNode } from "react";
import { cn } from "cn";

import { Card, CardContent } from "@/components/ui/card";

import { ProgressLine } from "./progress-line";
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
        "flex w-full outline-none focus-visible:ring-2 focus-visible:ring-ring",
        className
      )}
    >
      <Card size="sm" className="w-full">
        <CardContent>
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <Screen
                size="bar"
                still={state.look.still}
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
                  <Clock
                    playhead={playhead}
                    known={known}
                    duration={duration}
                    size="bar"
                  />
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
        </CardContent>
        <CardContent>
          <ProgressLine
            playhead={playhead}
            duration={known ? duration : null}
            label="Track progress"
          />
        </CardContent>
      </Card>
    </PlayerRegion>
  );
}
