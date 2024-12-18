import SignIn from "@/components/site/sign-in";
import SitePageHeader from "@/components/site/site-page-header";

export default function Home() {
  return (
    <div className="w-full flex flex-col items-start justify-start gap-2">
      <SitePageHeader title="~" components={<SignIn />} />
    </div>
  );
}
