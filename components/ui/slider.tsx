import * as React from "react";
import { Slider as SliderPrimitive } from "@base-ui/react/slider";
import { cn } from "cn";

import type { AccessibleName } from "@/lib/accessible-name";

function Slider({
  className,
  defaultValue,
  value,
  min = 0,
  max = 100,
  thumbLabels,
  getAriaValueText,
  ticks,
  ...props
}: SliderPrimitive.Root.Props & {
  /**
   * Accessible names for the thumbs, by index. Without them each thumb uses
   * the slider's aria-label, or its aria-labelledby when that is set instead.
   */
  thumbLabels?: string[];
  /**
   * The text each thumb announces for its value, such as "140.0 Hz" for a
   * slider whose position is not the value itself.
   */
  getAriaValueText?: SliderPrimitive.Thumb.Props["getAriaValueText"];
  /**
   * The number of divisions to rule under a horizontal track. Pair it with
   * a step that divides the range into that many divisions so the thumb
   * stops on the ticks. Vertical sliders draw no ticks.
   */
  ticks?: number;
} & AccessibleName) {
  // One thumb per array entry. A number, or no value at all, is one thumb.
  const thumbCount = Array.isArray(value)
    ? value.length
    : Array.isArray(defaultValue)
      ? defaultValue.length
      : 1;

  return (
    <SliderPrimitive.Root
      className={cn(
        "group/slider data-horizontal:w-full data-vertical:h-full",
        className
      )}
      data-slot="slider"
      defaultValue={defaultValue}
      value={value}
      min={min}
      max={max}
      thumbAlignment="edge"
      {...props}
    >
      {/*
       * Base UI takes presses on the Control, which is as thin as the track
       * because the thumbs are absolutely positioned, and blocks touch
       * scrolling on it. Under a coarse pointer, each thumb's ::after grows
       * to 44px instead, 17px out from inside the thumb's 1px border, so a
       * vertical swipe that starts beside the thumb scrolls the page rather
       * than moving the value.
       */}
      <SliderPrimitive.Control className="relative flex w-full touch-none items-center select-none data-disabled:opacity-50 data-vertical:h-full data-vertical:min-h-40 data-vertical:w-auto data-vertical:flex-col">
        <SliderPrimitive.Track
          data-slot="slider-track"
          className="dither-50 text-faint-foreground relative grow overflow-hidden rounded-none select-none data-horizontal:h-1 data-horizontal:w-full data-vertical:h-full data-vertical:w-1"
        >
          <SliderPrimitive.Indicator
            data-slot="slider-range"
            className="bg-primary select-none data-horizontal:h-full data-vertical:w-full"
          />
        </SliderPrimitive.Track>
        {/*
         * Base UI focuses a hidden range input inside each thumb, so the
         * ring and the dark glow key on has-focus-visible, not focus-visible.
         * In dark the thumb's color is the signal, so the glow draws in it,
         * and the border takes the core step while focused or dragged. A drag
         * that starts on the track moves the thumb without pressing it, so
         * data-dragging keys the glow as well as active.
         */}
        {Array.from({ length: thumbCount }, (_, index) => (
          <SliderPrimitive.Thumb
            data-slot="slider-thumb"
            key={index}
            index={index}
            aria-label={thumbLabels?.[index] ?? props["aria-label"]}
            getAriaValueText={getAriaValueText}
            className="border-ring bg-background alloy-raised ring-ring dark:text-signal dark:active:border-signal-bright dark:active:glow dark:has-focus-visible:border-signal-bright dark:has-focus-visible:glow dark:data-dragging:border-signal-bright dark:data-dragging:glow relative block size-3 shrink-0 rounded-none border shadow-none transition-[color,box-shadow] select-none after:absolute after:-inset-2 hover:ring-2 active:ring-2 disabled:pointer-events-none disabled:opacity-50 has-focus-visible:ring-2 pointer-coarse:after:-inset-4.25"
          />
        ))}
      </SliderPrimitive.Control>
      {/*
       * The 12px thumb stops half a thumb in from each track edge. Inset the
       * strip by that amount, with a pitch one pixel short so the last tick
       * lands on the last pixel.
       */}
      {ticks !== undefined && props.orientation !== "vertical" ? (
        <div
          aria-hidden="true"
          data-slot="slider-ticks"
          className="tick-strip text-faint-foreground mx-1.5 mt-1.5 group-data-disabled/slider:opacity-50"
          style={
            {
              "--tick-pitch": `calc((100% - 1px) / ${ticks})`,
            } as React.CSSProperties
          }
        />
      ) : null}
    </SliderPrimitive.Root>
  );
}

export { Slider };
