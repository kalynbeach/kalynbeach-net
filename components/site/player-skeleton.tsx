import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Sound's player card until the first track list arrives. Each box matches
 * the block's own, so the card takes the skeleton's place without moving
 * anything. Hidden from assistive tech: the player announces itself once it
 * renders.
 */
export function CardSkeleton() {
  return (
    <Card aria-hidden className="w-full">
      <CardHeader>
        {/* 24, as the block's header: its action spans a second, empty row. */}
        <div className="flex h-6 items-start justify-between">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-5 w-9" />
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col gap-3">
          <Skeleton className="aspect-square w-full" />
          <Skeleton className="h-5 w-24" />
          <Skeleton className="h-14 w-full" />
        </div>
      </CardContent>
      <CardContent>
        <div className="flex h-10 items-center justify-center gap-2">
          <Skeleton className="h-8 w-9" />
          <Skeleton className="h-8 w-11" />
          <Skeleton className="h-8 w-9" />
        </div>
      </CardContent>
    </Card>
  );
}

/** The Library until the first track list arrives, matching the block's 52 header and 34 rows. */
export function LibrarySkeleton() {
  return (
    <div aria-hidden className="flex w-full flex-col">
      <div className="flex h-13 items-center pt-0.5 pr-3 pl-4">
        <Skeleton className="h-4 w-14" />
      </div>
      <div className="flex flex-col px-1.5 pt-2 pb-3">
        <div className="flex h-8.5 items-center px-2.5">
          <Skeleton className="h-4 w-2/3" />
        </div>
        <div className="flex h-8.5 items-center px-2.5">
          <Skeleton className="h-4 w-1/2" />
        </div>
        <div className="flex h-8.5 items-center px-2.5">
          <Skeleton className="h-4 w-3/5" />
        </div>
      </div>
    </div>
  );
}
