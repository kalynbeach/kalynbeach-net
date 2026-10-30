"use client";

/*
 * The card: a Kevelle Card, 340 wide and at least 550 tall, as in the Paper
 * frame. The title wraps rather than truncates, and the card grows with it.
 */

import type { ReactNode } from "react";
import { cn } from "cn";

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
        "flex w-85 outline-none focus-visible:ring-2 focus-visible:ring-ring",
        className
      )}
    >
      <Card className="min-h-137.5 w-full">
        <CardHeader>
          <CardTitle>{current?.track.title ?? "No tracks"}</CardTitle>
          <CardAction>
            <div className="flex h-5 items-center gap-2">
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
            <div className="flex min-h-5 items-start justify-between gap-2">
              <p className="type-caption text-muted-foreground">{byline}</p>
              <span className="type-pixel text-muted-foreground shrink-0 tabular-nums">
                {current
                  ? formatOrdinal(current.index, state.tracks.length)
                  : null}
              </span>
            </div>
            <SeekBar
              state={state}
              playhead={playhead}
              onCommand={onCommand}
              size="card"
            />
          </div>
        </CardContent>
        <CardContent className="mt-auto">
          <Transport state={state} onCommand={onCommand} size="card" />
        </CardContent>
      </Card>
    </PlayerRegion>
  );
}
