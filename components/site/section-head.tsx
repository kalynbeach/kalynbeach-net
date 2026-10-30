import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * A 32px head row with a hairline under it: the timeline's "TIMELINE"
 * header. `children` sit at the right end. Spread props come after the
 * default slot, so the timeline can pass data-slot="timeline-header".
 */
export function SectionHead({
  title,
  children,
  className,
  ...props
}: { title: string; children?: ReactNode } & ComponentProps<"div">) {
  return (
    <div
      data-slot="section-head"
      {...props}
      className={cn(
        "flex h-row items-center justify-between border-b border-ramp-4",
        className
      )}
    >
      <h2 className="role-caps text-ramp-8">{title}</h2>
      {children}
    </div>
  );
}
