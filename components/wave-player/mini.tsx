"use client";

/*
 * The mini player, laid out for a narrow column rather than shrunk from the
 * card. It fills its container up to 240 wide, on a small Kevelle Card.
 *
 * A masthead spans the card: the title, which wraps and never truncates,
 * beside the expand control, then the artist and the status. Under it a
 * deck sets the 72px screen beside a large elapsed reading over the
 * duration, with the transport under the reading. A thin seek line closes
 * the card. Below 240 the deck's reading and transport wrap under the
 * screen, so a narrower column never scrolls sideways.
 */

import type { ReactElement, ReactNode } from "react";
import { ArrowsOutSimpleIcon } from "@phosphor-icons/react";
import { cn } from "cn";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

import { Clock } from "./readouts";
import { Screen } from "./screen";
import { SeekLine } from "./seek-bar";
import { ScreenOverlay, StatusBadge } from "./status";
import { STATUS_VIEW } from "./status-view";
import { PlayerRegion, Transport, type ViewInput } from "./transport";

export function MiniView({
  state,
  playhead,
  onCommand,
  screen,
  expand,
  className,
}: ViewInput & {
  /** What the screen box shows, such as a frame's dock of the provider's screen. Absent: an empty box. */
  readonly screen?: ReactNode;
  /** The link the expand control renders as, such as <Link href="/music" />. Absent: no control. */
  readonly expand?: ReactElement;
  /** Layout classes only. */
  readonly className?: string;
}) {
  const current = state.current;
  const view = STATUS_VIEW[state.status.kind];

  return (
    <PlayerRegion
      state={state}
      onCommand={onCommand}
      className={cn(
        "flex w-full max-w-60 outline-none focus-visible:ring-2 focus-visible:ring-ring",
        className
      )}
    >
      <Card size="sm" className="w-full">
        <CardHeader>
          <CardTitle>{current?.track.title ?? "No tracks"}</CardTitle>
          {expand ? (
            <CardAction>
              {/* Button's render prop keeps the site's router element, so a
                  Next Link navigates on the client and playback carries on. */}
              <Button
                variant="outline"
                size="icon"
                render={expand}
                nativeButton={false}
                aria-label="Open player"
              >
                <ArrowsOutSimpleIcon aria-hidden="true" />
              </Button>
            </CardAction>
          ) : null}
          <div className="flex min-h-5 flex-wrap items-center gap-x-2 gap-y-1">
            <p className="type-caption text-muted-foreground min-w-0">
              {current?.track.artist}
            </p>
            <StatusBadge state={state} />
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-stretch gap-3">
              <Screen
                size="mini"
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
              <div className="flex flex-1 flex-col justify-between gap-2">
                <Clock
                  playhead={playhead}
                  known={view.times}
                  duration={current?.track.duration ?? null}
                  size="mini"
                />
                <Transport
                  state={state}
                  onCommand={onCommand}
                  size="mini"
                  className="justify-start"
                />
              </div>
            </div>
            <SeekLine state={state} playhead={playhead} onCommand={onCommand} />
          </div>
        </CardContent>
      </Card>
    </PlayerRegion>
  );
}
