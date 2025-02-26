"use client";

import * as React from "react";
import * as RadioGroupPrimitive from "@radix-ui/react-radio-group";
import { Circle } from "lucide-react";

import { cn } from "@/lib/utils";

function RadioGroup({
  className,
  ...props
}: React.ComponentProps<typeof RadioGroupPrimitive.Root>) {
  return (
    <RadioGroupPrimitive.Root
      className={cn("grid gap-2", className)}
      data-slot="radio-group"
      {...props}
    />
  );
}

function RadioGroupItem({
  className,
  ...props
}: React.ComponentProps<typeof RadioGroupPrimitive.Item>) {
  return (
    <RadioGroupPrimitive.Item
      className={cn(
        "border-primary text-primary focus-visible:ring-ring aspect-square h-4 w-4 rounded-full border shadow-sm focus:outline-hidden focus-visible:ring-1 disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      data-slot="radio-item"
      {...props}
    >
      <RadioGroupPrimitive.Indicator
        className="flex items-center justify-center"
        data-slot="radio-indicator"
      >
        <Circle className="fill-primary h-3.5 w-3.5" />
      </RadioGroupPrimitive.Indicator>
    </RadioGroupPrimitive.Item>
  );
}

export { RadioGroup, RadioGroupItem };
