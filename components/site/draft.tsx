import type { ReactNode } from "react";
import { publishedOnly } from "@/lib/site";

/**
 * A section of a content file that production leaves out. Previews and dev
 * show it between a start marker and an end rule, so Kalyn can see what is
 * still a draft. To publish the section, remove the wrapper.
 *
 * A fragment, not a wrapper element: typeset-site spaces the children of
 * the typeset with `>` selectors, so the children must stay its direct
 * children. Both markers have a data-slot, so typeset leaves their type
 * alone and spaces them as components.
 */
export function Draft({ children }: { children: ReactNode }) {
  if (publishedOnly) return null;
  return (
    <>
      <p
        data-slot="draft-start"
        className="role-mono-sm text-ramp-7 border-ramp-6 border-t border-dashed pt-3"
      >
        Draft. Hidden on production.
      </p>
      {children}
      <hr
        data-slot="draft-end"
        className="border-ramp-6 border-t border-dashed"
      />
    </>
  );
}
