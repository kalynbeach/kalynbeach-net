import { Suspense } from "react";
import { getUsers } from "@/db/queries/users";
import SitePageHeader from "@/components/site/site-page-header";
import SiteAuth from "@/components/site/site-auth";

export default async function Dashboard() {
  const users = await getUsers();

  return (
    <div className="w-full flex flex-col items-start justify-start gap-4">
      <SitePageHeader title="dashboard" />
      <Suspense fallback={<div className="font-mono text-sm">loading...</div>}>
        <SiteAuth />
      </Suspense>
      <div className="w-full">
        <p className="font-mono">Users</p>
        <pre>{JSON.stringify(users, null, 2)}</pre>
      </div>
    </div>
  );
}
