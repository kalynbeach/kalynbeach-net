import Image from "next/image";
import { Skeleton } from "@/components/ui/skeleton";

type Shot = { src: string; alt: string };

/**
 * A screenshot with a light and a dark capture, shown by the site's theme,
 * in a 1px frame, with its caption beside it and bottom-aligned from 1200px
 * up and under it below. `sizes` is the image's width inside the frame's
 * border at each width. Both captures share `width` and
 * `height`, which reserve the frame's height before the image loads. Until
 * then, or if it never does, the frame is Kevelle's Skeleton, held still so
 * the loaded capture doesn't pulse with it; the opaque capture covers it
 * once it paints.
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
  const sizes = "(min-width: 75rem) 302px, 254px";
  return (
    <figure
      data-slot="screenshot"
      className="desktop:flex-row desktop:items-end desktop:gap-6 flex flex-col gap-3"
    >
      <Skeleton className="border-ramp-4 desktop:w-76 w-64 shrink-0 animate-none border">
        <Image
          src={light.src}
          alt={light.alt}
          width={width}
          height={height}
          sizes={sizes}
          className="block h-auto w-full dark:hidden"
        />
        <Image
          src={dark.src}
          alt={dark.alt}
          width={width}
          height={height}
          sizes={sizes}
          className="hidden h-auto w-full dark:block"
        />
      </Skeleton>
      <figcaption className="role-mono-sm text-ramp-7">{caption}</figcaption>
    </figure>
  );
}
