"use client";

/*
 * The card, on a Kevelle Card. It fills its container up to 340 wide, as in
 * the Paper frame, and shrinks below that without overflowing. Its rows are
 * the title, the status and duration, the screen, the byline, the tag, the
 * bar-waveform seek bar, and the transport. Titles wrap rather than
 * truncate, and the card grows with them.
 */

import type { ReactNode } from "react";
import { cn } from "cn";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

import { formatClock, formatOrdinal } from "./format";
import { Screen } from "./screen";
import { SeekBar } from "./seek-bar";
import { ScreenOverlay, StatusBadge } from "./status";
import { STATUS_VIEW } from "./status-view";
import { PlayerRegion, Transport, type ViewInput } from "./transport";

export function CardView({
  state,
  playhead,
  onCommand,
  screen,
  className,
}: ViewInput & {
  /** What the screen box shows, such as a frame's dock of the provider's screen. Absent: an empty box. */
  readonly screen?: ReactNode;
  /** Layout classes only. */
  readonly className?: string;
}) {
  const current = state.current;
  const view = STATUS_VIEW[state.status.kind];

  const byline = [current?.track.artist, current?.track.record]
    .filter(Boolean)
    .join(" · ");

  return (
    <PlayerRegion
      state={state}
      onCommand={onCommand}
      className={cn(
        "flex w-full max-w-85 outline-none focus-visible:ring-2 focus-visible:ring-ring",
        className
      )}
    >
      <Card className="w-full">
        <CardHeader>
          <CardTitle>{current?.track.title ?? "No tracks"}</CardTitle>
          <CardAction>
            <div className="flex min-h-5 items-center gap-2">
              <StatusBadge state={state} />
              <span className="type-pixel text-muted-foreground tabular-nums">
                {formatClock(
                  view.times ? (current?.track.duration ?? null) : null
                )}
              </span>
            </div>
          </CardAction>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-3">
            <Screen
              size="card"
              overlay={
                <ScreenOverlay state={state} onCommand={onCommand} fit="full" />
              }
            >
              {screen}
            </Screen>
            <div className="flex flex-col gap-1">
              <div className="flex min-h-5 items-start justify-between gap-2">
                <p className="type-caption text-muted-foreground min-w-0">
                  {byline}
                </p>
                <span className="type-pixel text-muted-foreground shrink-0 tabular-nums">
                  {current
                    ? formatOrdinal(current.index, state.tracks.length)
                    : null}
                </span>
              </div>
              {current?.track.tag ? (
                <Badge variant="outline">{current.track.tag}</Badge>
              ) : null}
            </div>
            <SeekBar state={state} playhead={playhead} onCommand={onCommand} />
          </div>
        </CardContent>
        <CardContent>
          <Transport state={state} onCommand={onCommand} size="card" />
        </CardContent>
      </Card>
    </PlayerRegion>
  );
}
