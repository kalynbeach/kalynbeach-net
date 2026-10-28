"use client";

import { Progress as ProgressPrimitive } from "@base-ui/react/progress";
import { cn } from "cn";

function Progress({
  className,
  children,
  value,
  size = "default",
  ...props
}: ProgressPrimitive.Root.Props & {
  /**
   * "sm" is a 3px groove, a dithered progress line for a dense surface such
   * as a player bar. Its odd height starts and ends the groove's dither on
   * a lit row, as the default 8px groove cannot.
   */
  size?: "default" | "sm";
}) {
  return (
    <ProgressPrimitive.Root
      value={value}
      data-slot="progress"
      data-size={size}
      className={cn("group/progress flex flex-wrap gap-3", className)}
      {...props}
    >
      {children}
      <ProgressTrack>
        <ProgressIndicator />
      </ProgressTrack>
    </ProgressPrimitive.Root>
  );
}

function ProgressTrack({ className, ...props }: ProgressPrimitive.Track.Props) {
  return (
    <ProgressPrimitive.Track
      className={cn(
        "relative flex h-2 w-full items-center overflow-x-hidden rounded-none bg-muted dither-25 text-faint-foreground alloy-recessed group-data-[size=sm]/progress:h-0.75 dark:bg-background",
        className
      )}
      data-slot="progress-track"
      {...props}
    />
  );
}

function ProgressIndicator({
  className,
  ...props
}: ProgressPrimitive.Indicator.Props) {
  return (
    <ProgressPrimitive.Indicator
      data-slot="progress-indicator"
      className={cn(
        // A dithered signal ramp, sparse where it starts and solid at the
        // leading edge. rtl mirrors it with the indicator.
        "h-full dither-ramp text-signal transition-[width] data-indeterminate:w-1/3 data-indeterminate:animate-progress-sweep rtl:-scale-x-100",
        className
      )}
      {...props}
    />
  );
}

function ProgressLabel({ className, ...props }: ProgressPrimitive.Label.Props) {
  return (
    <ProgressPrimitive.Label
      className={cn("type-label", className)}
      data-slot="progress-label"
      {...props}
    />
  );
}

function ProgressValue({ className, ...props }: ProgressPrimitive.Value.Props) {
  return (
    <ProgressPrimitive.Value
      className={cn(
        "ml-auto type-pixel text-muted-foreground tabular-nums",
        className
      )}
      data-slot="progress-value"
      {...props}
    />
  );
}

export {
  Progress,
  ProgressTrack,
  ProgressIndicator,
  ProgressLabel,
  ProgressValue,
};
