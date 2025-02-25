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
    <Card className="wave-player aspect-[5/7] w-[380px] flex flex-col border rounded-none">
      {/* Track Info Skeleton */}
      <CardHeader className="w-full p-2">
        <div className="wave-player-track-info w-full h-full flex flex-col gap-1 border border-muted/50 p-2">
          <div className="h-6 w-3/4 bg-muted/50 animate-pulse rounded-sm" />
          <div className="space-y-2 mt-1">
            <div className="h-4 w-1/2 bg-muted/40 animate-pulse rounded-sm" />
            <div className="h-4 w-1/3 bg-muted/30 animate-pulse rounded-sm" />
          </div>
        </div>
      </CardHeader>

      {/* Visualization Skeleton */}
      <CardContent className="w-full h-full flex flex-col items-center justify-center px-2 py-0">
        <div className="wave-player-track-visual relative w-full">
          <div className="size-[362px] border border-muted flex items-center justify-center bg-background/5">
            <div className="w-full h-1/3 flex items-center justify-center">
              <div className="w-11/12 h-1 bg-muted/30 relative overflow-hidden">
                <div 
                  className="absolute top-0 left-0 h-full w-full bg-muted/60 animate-pulse"
                  style={{ animationDuration: "1.5s" }}
                />
              </div>
            </div>
          </div>
        </div>
      </CardContent>

      {/* Controls Skeleton */}
      <CardFooter className="w-full flex flex-col items-center justify-center p-2">
        <div className="wave-player-track-controls w-full flex flex-col items-center justify-center gap-2 border border-muted/50 p-4 relative">
          {/* Progress Slider Skeleton */}
          <div className="w-full space-y-2 flex flex-col items-center justify-center px-2">
            <div className="w-full h-3 bg-muted/40 rounded-full">
              <div 
                className="h-full bg-muted/60 rounded-full animate-pulse" 
                style={{ width: "30%", animationDuration: "2s" }}
              />
            </div>
            <div className="w-full flex flex-row justify-between text-sm">
              <div className="h-4 w-10 bg-muted/40 animate-pulse rounded-sm" />
              <div className="h-4 w-10 bg-muted/40 animate-pulse rounded-sm" />
            </div>
          </div>

          {/* Main Controls Skeleton */}
          <div className="w-full flex items-center justify-center gap-4">
            <div className="h-8 w-8 rounded-full bg-muted/40 animate-pulse" />
            <div className="h-10 w-10 rounded-full bg-muted/50 animate-pulse" />
            <div className="h-8 w-8 rounded-full bg-muted/40 animate-pulse" />
          </div>
        </div>
      </CardFooter>
    </Card>
  );
} 