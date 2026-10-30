"use client";

/*
 * The Library. Titles wrap rather than truncate.
 */

import { useId } from "react";
import { cn } from "cn";

import { Button } from "@/components/ui/button";
import { Empty, EmptyDescription } from "@/components/ui/empty";

import { formatClock, formatCount } from "./format";
import { statusAttribute, type ViewInput } from "./transport";

/** The list shows no progress, so it takes no playhead and never renders per frame. */
export function TrackListView({
  state,
  onCommand,
  className,
}: Omit<ViewInput, "playhead"> & {
  /** Layout classes only. */
  readonly className?: string;
}) {
  const heading = useId();
  const playing = state.status.kind === "playing";

  return (
    <section
      aria-labelledby={heading}
      data-status={statusAttribute(state)}
      className={cn("flex w-full flex-col", className)}
    >
      <div className="flex h-13 items-center gap-2 pt-0.5 pr-3 pl-4">
        <h2 id={heading} className="type-label text-foreground">
          Library
        </h2>
        <span className="type-pixel text-muted-foreground tabular-nums">
          {formatCount(state.tracks.length)}
        </span>
      </div>
      {state.tracks.length === 0 ? (
        <Empty>
          <EmptyDescription>No tracks yet.</EmptyDescription>
        </Empty>
      ) : (
        <ol className="flex flex-col px-1.5 pt-2 pb-3">
          {state.tracks.map((track, index) => {
            const current = index === state.current?.index;

            return (
              <li key={track.id}>
                <Button
                  variant={current ? "secondary" : "ghost"}
                  aria-current={current ? "true" : undefined}
                  onClick={() =>
                    onCommand({ type: "play-track", id: track.id })
                  }
                  className="h-auto min-h-8 w-full justify-between"
                >
                  <span className="min-w-0 py-1.5 text-left whitespace-normal">
                    {track.title}
                  </span>
                  <span className="flex shrink-0 items-center gap-2">
                    {current && playing ? (
                      <span aria-hidden="true" className="led" />
                    ) : null}
                    <span
                      className={cn(
                        "type-pixel tabular-nums",
                        current ? "text-signal" : "text-muted-foreground"
                      )}
                    >
                      {formatClock(track.duration)}
                    </span>
                  </span>
                </Button>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
