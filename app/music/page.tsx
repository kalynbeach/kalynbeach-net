import { pageMetadata } from "@/lib/site";

export const metadata = pageMetadata("/music");

/**
 * Music's player is its site map entry (`player: "full"` in lib/site.ts): the
 * shell draws the card at the top of section 1's body and the Library in
 * section 3. Content returned here renders under the card.
 */
export default function Music() {
  return null;
}
