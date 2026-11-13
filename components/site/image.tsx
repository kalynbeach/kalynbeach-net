import NextImage, { type StaticImageData } from "next/image";

/**
 * A photo in a page's content column, at the column's full width and the
 * photo's natural ratio. Use it in content files with a photo statically
 * imported from content/images/: `<Image src={photo} alt="..." />`.
 *
 * Visitors get the imported file itself, never an optimizer re-encode, so the
 * photo keeps its source quality and "Open image in new tab" opens the
 * original. Every visitor downloads the whole file, so export it web-ready.
 *
 * `src` is a static import, so the file's own width and height reserve the
 * box before it loads, and Next's build-time blurDataURL paints under it
 * until it does. A string path gives neither, so the type refuses one.
 *
 * `hero` marks the page's lead image, above the fold, on one image per page
 * at most. It loads eagerly at high fetch priority; every other image loads
 * lazily. The two move together because high priority alone keeps Next's
 * lazy default. React's server renderer already hoists a head preload for any
 * image that isn't lazy, at the image's fetch priority, so the component never
 * sets Next's `preload`.
 *
 * Typeset skips the image because of its data-slot, so the hairline here
 * repeats typeset's media rule.
 */
export function Image({
  src,
  alt,
  hero = false,
}: {
  src: StaticImageData;
  alt: string;
  hero?: boolean;
}) {
  return (
    <NextImage
      data-slot="image"
      src={src}
      alt={alt}
      unoptimized
      // A static GIF or SVG has no blurDataURL, and "blur" without one throws.
      placeholder={src.blurDataURL ? "blur" : "empty"}
      loading={hero ? "eager" : "lazy"}
      fetchPriority={hero ? "high" : undefined}
      className="outline-border block h-auto w-full outline -outline-offset-1"
    />
  );
}
