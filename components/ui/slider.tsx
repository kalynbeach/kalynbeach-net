"use client";

import * as React from "react";
import * as SliderPrimitive from "@radix-ui/react-slider";

import { cn } from "@/lib/utils";

function Slider({
  className,
  ...props
}: React.ComponentProps<typeof SliderPrimitive.Root>) {
  return (
    <SliderPrimitive.Root
      className={cn(
        "relative flex w-full touch-none items-center select-none",
        className
      )}
      data-slot="slider"
      {...props}
    >
      <SliderPrimitive.Track
        className="bg-primary/20 relative h-1.5 w-full grow overflow-hidden rounded-full"
        data-slot="track"
      >
        <SliderPrimitive.Range
          className="bg-primary absolute h-full"
          data-slot="range"
        />
      </SliderPrimitive.Track>
      <SliderPrimitive.Thumb
        className="border-primary/50 bg-background focus-visible:ring-ring block h-4 w-4 rounded-full border shadow transition-colors focus-visible:ring-1 focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50"
        data-slot="thumb"
      />
    </SliderPrimitive.Root>
  );
}

export { Slider };
