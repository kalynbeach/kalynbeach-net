import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export function SoundCardSkeleton() {
  return (
    <Card className="sound-card-skeleton w-full rounded-sm border py-0 shadow-xs">
      <CardContent className="bg-card flex flex-col gap-3 rounded-sm p-3">
        {/* Section 1: Header */}
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
          {/* 1a: Title & Status */}
          <div className="flex w-full flex-row items-center justify-between">
            <Skeleton className="h-6 w-24 rounded-sm" /> {/* For "SoundCard" title */}
            <Skeleton className="h-6 w-20 rounded-sm" /> {/* For status message "initialized" */}
          </div>
          {/* 1b: Output Toggle & Mobile Buttons */}
          <div className="flex flex-row items-center justify-end gap-3">
            {/* Output Toggle Box (w-[100px] h-[30px]) */}
            <div className="flex h-[30px] w-[100px] items-center space-x-2 rounded-sm border border-accent px-2 dark:bg-input/10 dark:border-input/80">
              {/* Combined placeholder for "output" label and Switch */}
              <Skeleton className="h-5 w-full rounded-sm" />
            </div>
            {/* Mobile Buttons (start/stop) */}
            <div className="flex flex-row items-center gap-3 md:hidden">
              <Skeleton className="h-9 w-16 rounded-sm" />
              <Skeleton className="h-9 w-16 rounded-sm" />
            </div>
          </div>
        </div>

        {/* Section 2: Device Select & Desktop Buttons */}
        <div className="w-full items-end justify-between gap-3 md:flex md:flex-row">
          {/* SoundDeviceSelect placeholder */}
          <Skeleton className="h-9 w-full rounded-sm md:flex-1 md:min-w-0" />

          {/* Desktop Buttons placeholder */}
          <div className="hidden flex-row items-center gap-3 md:flex">
            <Skeleton className="h-9 w-16 rounded-sm" />
            <Skeleton className="h-9 w-16 rounded-sm" />
          </div>
        </div>

        {/* Section 3: Visualizer */}
        <Skeleton className="h-64 w-full rounded-sm border" />

        {/* Section 4: Debug Info */}
        <Skeleton className="h-48 w-full rounded-sm border p-3"/>
      </CardContent>
    </Card>
  );
}
