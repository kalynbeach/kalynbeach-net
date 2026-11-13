import type { ReactNode } from "react";
import { requireConvexAdmin } from "@/lib/convex/server";

/**
 * Admin pages check the visitor before sending anything, so a redirect to
 * /login stays a real redirect. Cache Components would rather prerender a
 * shell; this lets the segment block on the check per request instead.
 */
export const instant = false;

type AdminLayoutProps = {
  children: ReactNode;
};

export default async function AdminLayout({ children }: AdminLayoutProps) {
  await requireConvexAdmin();

  return children;
}
