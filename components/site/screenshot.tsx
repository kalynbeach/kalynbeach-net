import Image from "next/image";
import { Skeleton } from "@/components/ui/skeleton";

type Shot = { src: string; alt: string };

/**
 * A screenshot with a light and a dark capture, shown by the site's theme,
 * at most 320 wide. Both captures share `width` and `height`, which reserve
 * the frame's height before the image loads. Until then, or if it never
 * does, the frame is Kevelle's Skeleton, held still so the loaded capture
 * doesn't pulse with it; the opaque capture covers it once it paints.
 */
export function Screenshot({
  light,
  dark,
  width,
  height,
  caption,
}: {
  light: Shot;
  dark: Shot;
  width: number;
  height: number;
  caption: string;
}) {
  return (
    <figure
      data-slot="screenshot"
      className="flex w-full max-w-80 flex-col gap-3"
    >
      <Skeleton className="border-ramp-4 animate-none border">
        <Image
          src={light.src}
          alt={light.alt}
          width={width}
          height={height}
          sizes="320px"
          className="block h-auto w-full dark:hidden"
        />
        <Image
          src={dark.src}
          alt={dark.alt}
          width={width}
          height={height}
          sizes="320px"
          className="hidden h-auto w-full dark:block"
        />
      </Skeleton>
      <figcaption className="role-meta text-ramp-6">{caption}</figcaption>
    </figure>
  );
}
