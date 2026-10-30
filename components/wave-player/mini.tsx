"use client";

/*
 * The mini player: the card at the side column's width, on a small Kevelle
 * Card. It fills its container (200px in the frame, as narrow as 192px).
 * The title wraps beside the expand control instead of truncating. A
 * status Badge sits between the times, so a status change never moves the
 * rows below it.
 */

import type { ReactElement, ReactNode } from "react";
import { ArrowsOutSimpleIcon } from "@phosphor-icons/react";
import { cn } from "cn";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

import { formatOrdinal } from "./format";
import { Screen } from "./screen";
import { SeekBar } from "./seek-bar";
import { ScreenOverlay, StatusBadge } from "./status";
import { PlayerRegion, Transport, type ViewInput } from "./transport";

export function MiniView({
  state,
  playhead,
  onCommand,
  screen,
  expand,
  className,
}: ViewInput & {
  readonly screen?: ReactNode;
  /** The link the expand control renders as, such as <Link href="/music" />. Absent: no control. */
  readonly expand?: ReactElement;
  /** Layout classes only. */
  readonly className?: string;
}) {
  const current = state.current;

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
        {/* Paper's 52px header row, measured from the card's top edge. */}
        <CardHeader className="min-h-10">
          <CardTitle>{current?.track.title ?? "No tracks"}</CardTitle>
          {expand ? (
            <CardAction>
              {/* Button's render prop keeps the site's router element, so a
               * Next Link navigates on the client and playback carries on. */}
              <Button
                variant="ghost"
                size="icon-xs"
                render={expand}
                nativeButton={false}
                aria-label="Open player"
              >
                <ArrowsOutSimpleIcon
                  aria-hidden="true"
                  className="text-muted-foreground group-hover/button:text-foreground"
                />
              </Button>
            </CardAction>
          ) : null}
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-3">
            <Screen
              size="mini"
              overlay={
                <ScreenOverlay
                  state={state}
                  onCommand={onCommand}
                  fit="compact"
                />
              }
            >
              {screen}
            </Screen>
            <div className="flex flex-col gap-1">
              <div className="flex items-start justify-between gap-2">
                <p className="type-caption text-muted-foreground min-w-0">
                  {current?.track.artist}
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
            <SeekBar
              state={state}
              playhead={playhead}
              onCommand={onCommand}
              size="mini"
              status={<StatusBadge state={state} />}
            />
            <Transport state={state} onCommand={onCommand} size="mini" />
          </div>
        </CardContent>
      </Card>
    </PlayerRegion>
  );
}
