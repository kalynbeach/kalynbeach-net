import SitePageHeader from "@/components/site/site-page-header";
import SiteAuth from "@/components/site/site-auth";

export default function Login() {
  return (
    <div className="w-full flex flex-col items-start justify-start gap-2">
      <SitePageHeader title="login" />
      <SiteAuth />
    </div>
  );
}
