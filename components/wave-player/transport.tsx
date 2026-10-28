"use client";

/*
 * What every view shares: its input, its root, and the transport.
 *
 * The transport is Kevelle Buttons, as the oscilloscope's and Binaural
 * Beats' are. Widths are layout classes, which a block may pass to Button.
 */

import type { KeyboardEvent, ReactNode } from "react";
import {
  ArrowClockwiseIcon,
  PauseIcon,
  PlayIcon,
  SkipBackIcon,
  SkipForwardIcon,
} from "@phosphor-icons/react";
import { cn } from "cn";

import { Button } from "@/components/ui/button";
import { Kbd } from "@/components/ui/kbd";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

import { spaceToggles } from "./keys";
import { hasNext, type PlayerCommand, type PlayerState } from "./model";
import type { Playhead } from "./playhead";
import { STATUS_VIEW, type StatusView } from "./status-view";

/** What every view renders from. The provider's views fill it from the store; the states workbench from fixtures. */
export type ViewInput = {
  readonly state: PlayerState;
  readonly playhead: Playhead;
  /** Call inside the gesture: a play must start in the click's own call stack. */
  readonly onCommand: (command: PlayerCommand) => void;
};

/** data-status on each view root, for headless runners: a status kind, "failed-<reason>", or "empty". */
export function statusAttribute(state: PlayerState): string {
  if (!state.current) return "empty";

  return state.status.kind === "failed"
    ? `failed-${state.status.reason}`
    : state.status.kind;
}

/**
 * The labelled, focusable root of a view with a transport. Space toggles
 * from anywhere inside it except a control that takes Space itself.
 */
export function PlayerRegion({
  state,
  onCommand,
  className,
  children,
}: Omit<ViewInput, "playhead"> & {
  readonly className: string;
  readonly children: ReactNode;
}) {
  const onKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (!spaceToggles(event)) return;

    event.preventDefault();
    onCommand({ type: "toggle" });
  };

  return (
    // oxlint-disable-next-line jsx-a11y/no-noninteractive-element-interactions -- Space plays and pauses from inside the region, with no window key handler.
    <section
      aria-label="Music player"
      // oxlint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- The region takes focus so Space reaches it; every control inside keeps Space for itself.
      tabIndex={0}
      onKeyDown={onKeyDown}
      data-status={statusAttribute(state)}
      data-track={state.current?.track.id}
      className={className}
    >
      {children}
    </section>
  );
}

export type TransportSize = "card" | "mini" | "bar";

const ROW = {
  card: "h-10 gap-2",
  mini: "h-8 gap-1",
  bar: "h-9 gap-0.5",
} as const satisfies Record<TransportSize, string>;

/**
 * Previous, play or pause, and next. Next is disabled on the last track and
 * everything is disabled without tracks. A failure disables nothing, so a
 * person can retry or move on.
 */
export function Transport({
  state,
  onCommand,
  size,
  className,
}: Omit<ViewInput, "playhead"> & {
  readonly size: TransportSize;
  /** Layout classes only. */
  readonly className?: string;
}) {
  const view = STATUS_VIEW[state.status.kind];
  const empty = state.current === null;
  const large = size === "bar";

  return (
    <div
      className={cn("flex items-center justify-center", ROW[size], className)}
    >
      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              variant="ghost"
              size={large ? "icon-lg" : "icon"}
              className={large ? undefined : "w-9"}
              aria-label="Previous track"
              disabled={empty}
              onClick={() => onCommand({ type: "previous" })}
            />
          }
        >
          <SkipBackIcon aria-hidden="true" />
        </TooltipTrigger>
        <TooltipContent>Previous track</TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              size={large ? "icon-lg" : "icon"}
              className={large ? "w-10" : "w-11"}
              aria-label={view.label}
              disabled={empty}
              onClick={() => onCommand({ type: "toggle" })}
            />
          }
        >
          <ToggleGlyph glyph={view.glyph} />
        </TooltipTrigger>
        <TooltipContent>
          {view.label}
          <Kbd>Space</Kbd>
        </TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              variant="ghost"
              size={large ? "icon-lg" : "icon"}
              className={large ? undefined : "w-9"}
              aria-label="Next track"
              disabled={!hasNext(state)}
              onClick={() => onCommand({ type: "next" })}
            />
          }
        >
          <SkipForwardIcon aria-hidden="true" />
        </TooltipTrigger>
        <TooltipContent>Next track</TooltipContent>
      </Tooltip>
    </div>
  );
}

function ToggleGlyph({ glyph }: { readonly glyph: StatusView["glyph"] }) {
  switch (glyph) {
    case "play":
      return <PlayIcon aria-hidden="true" />;
    case "pause":
      return <PauseIcon aria-hidden="true" />;
    case "retry":
      return <ArrowClockwiseIcon aria-hidden="true" />;
    default:
      return glyph satisfies never;
  }
}
