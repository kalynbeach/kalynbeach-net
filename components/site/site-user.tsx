import { UserButton } from "@clerk/nextjs";

export default function SiteUser() {
  return (
    <div className="site-user flex flex-row items-center gap-2 font-mono text-sm font-medium">
      <UserButton showName />
    </div>
  );
}
