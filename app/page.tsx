import SignIn from "@/components/site/sign-in";
import SiteAuth from "@/components/site/site-auth";
import SitePageHeader from "@/components/site/site-page-header";

export default function Home() {
  return (
    <div className="w-full flex flex-col items-start justify-start gap-2">
      <SitePageHeader title="~" components={<SiteAuth />} />
    </div>
  );
}
