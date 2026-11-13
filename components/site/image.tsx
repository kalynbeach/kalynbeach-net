import NextImage, { type StaticImageData } from "next/image";

/**
 * The content column's width, as `sizes`. From 1200px (75rem) section 1 is at
 * most 37.5rem wide, the cap in --spacing-section, and below it the column is
 * the viewport less 4rem (the 12px edge and 20px padding on each side). Both
 * are rems, so they follow a larger default font. Between 1200 and about
 * 1317px the column is 498 to 600px, so the cap overstates it by at most one
 * srcset step. `vw` counts a classic scrollbar and the shell measures `cqi`,
 * which doesn't, so the value errs high, never low. tests/site.test.ts checks
 * the breakpoint and the cap against app/globals.css.
 */
const sizes = "(min-width: 75rem) 37.5rem, calc(100vw - 4rem)";

/**
 * A photo in a page's content column, at the column's full width and the
 * photo's natural ratio. Use it in content files with a photo statically
 * imported from content/images/: `<Image src={photo} alt="..." />`.
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
      sizes={sizes}
      // A static GIF or SVG has no blurDataURL, and "blur" without one throws.
      placeholder={src.blurDataURL ? "blur" : "empty"}
      loading={hero ? "eager" : "lazy"}
      fetchPriority={hero ? "high" : undefined}
      className="outline-border block h-auto w-full outline -outline-offset-1"
    />
  );
}
