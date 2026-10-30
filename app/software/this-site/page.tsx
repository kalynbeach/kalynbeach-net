import { pageMetadata } from "@/lib/site";
import { PageHeader } from "@/components/site/page-header";

export const metadata = pageMetadata("/software/this-site");

export default function ThisSite() {
  return <PageHeader {...metadata} />;
}
