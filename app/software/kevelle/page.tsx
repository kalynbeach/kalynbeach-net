import { pageMetadata } from "@/lib/site";
import { PageHeader } from "@/components/site/page-header";

export const metadata = pageMetadata("/software/kevelle");

export default function Kevelle() {
  return <PageHeader {...metadata} />;
}
