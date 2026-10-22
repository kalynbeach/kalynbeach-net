import { cn } from "cn";

function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      className={cn(
        "animate-pulse rounded-none dither-50 text-muted-foreground/30",
        className
      )}
      {...props}
    />
  );
}

export { Skeleton };
