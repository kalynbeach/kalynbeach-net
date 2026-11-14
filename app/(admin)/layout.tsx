import type { ReactNode } from "react";
import { requireConvexAdmin } from "@/lib/convex/server";

/**
 * proxy.ts sends signed-out visitors to /login with a real 307 before this
 * runs. This layout is the authority on the admin role, and `instant = false`
 * lets it block on that check per request. The shell's status is already
 * sent by then, so its redirects arrive in the stream. A signed-in guest
 * gets a 200 and an in-page redirect to /auth/unauthorized.
 */
export const instant = false;

type AdminLayoutProps = {
  children: ReactNode;
};

export default async function AdminLayout({ children }: AdminLayoutProps) {
  await requireConvexAdmin();

  return children;
}
