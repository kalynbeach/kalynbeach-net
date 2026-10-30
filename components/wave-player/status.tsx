"use client";

/*
 * What a view shows for a status the transport can't say on its own: a
 * Badge, and what covers the screen while a track loads or after it fails.
 * The provider's live region speaks every status, so the Spinner and the
 * Alert stay out of the accessibility tree's live regions.
 */

import { ArrowClockwiseIcon, WarningCircleIcon } from "@phosphor-icons/react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";

import type { PlayerCommand, PlayerState } from "./model";
import { FAILURE, STATUS_VIEW } from "./status-view";

export function StatusBadge({ state }: { readonly state: PlayerState }) {
  const badge = STATUS_VIEW[state.status.kind].badge;

  return badge ? <Badge variant={badge.variant}>{badge.label}</Badge> : null;
}

/**
 * Covers the screen box without replacing its slot. "full" is the card's
 * Alert with its description; "compact" drops the description for the
 * mini's narrower screen; "spinner" draws only the loading spinner, for the
 * bar's 36px box.
 */
export function ScreenOverlay({
  state,
  onCommand,
  fit,
}: {
  readonly state: PlayerState;
  readonly onCommand: (command: PlayerCommand) => void;
  readonly fit: "full" | "compact" | "spinner";
}) {
  const overlay = STATUS_VIEW[state.status.kind].overlay;

  if (overlay === "spinner")
    return (
      <div className="absolute inset-0 flex items-center justify-center">
        {fit === "spinner" ? (
          <Spinner aria-hidden="true" />
        ) : (
          <div className="border-input bg-background flex size-8 items-center justify-center border">
            <Spinner aria-hidden="true" />
          </div>
        )}
      </div>
    );

  if (
    overlay !== "failure" ||
    state.status.kind !== "failed" ||
    fit === "spinner"
  )
    return null;

  const failure = FAILURE[state.status.reason];

  return (
    <div className="absolute inset-0 flex items-center justify-center p-3">
      <Alert role="note" variant="destructive">
        <WarningCircleIcon aria-hidden="true" />
        <AlertTitle>{failure.title}</AlertTitle>
        {fit === "full" ? (
          <AlertDescription>{failure.description}</AlertDescription>
        ) : null}
        {failure.retry ? (
          <div className="col-start-2 mt-2">
            <Button size="sm" onClick={() => onCommand({ type: "toggle" })}>
              <ArrowClockwiseIcon data-icon="inline-start" aria-hidden="true" />
              Retry
            </Button>
          </div>
        ) : null}
      </Alert>
    </div>
  );
}
