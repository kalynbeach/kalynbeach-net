import {
  Card,
  CardHeader,
  CardContent,
  CardFooter,
} from "@/components/ui/card";

/**
 * Skeleton loader for WavePlayer component that maintains the same dimensions and structure
 * to prevent layout shifts during loading states.
 */
export default function WavePlayerSkeleton() {
  return (
    <Card className="wave-player bg-background flex aspect-[5/7] w-[380px] flex-col rounded-none border">
      {/* Track Info Skeleton */}
      <CardHeader className="w-full p-2">
        <div className="wave-player-track-info border-muted/50 flex h-full w-full flex-col gap-1 border p-2">
          <div className="bg-muted/50 h-6 w-3/4 animate-pulse rounded-sm" />
          <div className="mt-1 space-y-2">
            <div className="bg-muted/40 h-4 w-1/2 animate-pulse rounded-sm" />
            <div className="bg-muted/30 h-4 w-1/3 animate-pulse rounded-sm" />
          </div>
        </div>
      </CardHeader>

      {/* Visualization Skeleton */}
      <CardContent className="flex h-full w-full flex-col items-center justify-center px-2 py-0">
        <div className="wave-player-track-visual relative w-full">
          <div className="border-muted bg-background/5 flex size-[362px] items-center justify-center border">
            <div className="flex h-1/3 w-full items-center justify-center">
              <div className="bg-muted/30 relative h-1 w-11/12 overflow-hidden">
                <div
                  className="bg-muted/60 absolute top-0 left-0 h-full w-full animate-pulse"
                  style={{ animationDuration: "1.5s" }}
                />
              </div>
            </div>
          </div>
        </div>
      </CardContent>

      {/* Controls Skeleton */}
      <CardFooter className="flex w-full flex-col items-center justify-center p-2">
        <div className="wave-player-track-controls border-muted/50 relative flex w-full flex-col items-center justify-center gap-2 border p-4">
          {/* Progress Slider Skeleton */}
          <div className="flex w-full flex-col items-center justify-center space-y-2 px-2">
            <div className="bg-muted/40 h-3 w-full rounded-full">
              <div
                className="bg-muted/60 h-full animate-pulse rounded-full"
                style={{ width: "30%", animationDuration: "2s" }}
              />
            </div>
            <div className="flex w-full flex-row justify-between text-sm">
              <div className="bg-muted/40 h-4 w-10 animate-pulse rounded-sm" />
              <div className="bg-muted/40 h-4 w-10 animate-pulse rounded-sm" />
            </div>
          </div>

          {/* Main Controls Skeleton */}
          <div className="flex w-full items-center justify-center gap-4">
            <div className="bg-muted/40 h-8 w-8 animate-pulse rounded-full" />
            <div className="bg-muted/50 h-10 w-10 animate-pulse rounded-full" />
            <div className="bg-muted/40 h-8 w-8 animate-pulse rounded-full" />
          </div>
        </div>
      </CardFooter>
    </Card>
  );
}
