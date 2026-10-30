import { pageMetadata } from "@/lib/site";
import { PageHeader } from "@/components/site/page-header";

export const metadata = pageMetadata("/music");

/** Music's player role is "full", so the shell draws the card and the Library after this. */
export default function Music() {
  return <PageHeader {...metadata} />;
}
