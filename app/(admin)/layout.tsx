import type { ReactNode } from "react";
import { requireConvexAdmin } from "@/lib/convex/server";

type AdminLayoutProps = {
  children: ReactNode;
};

export default async function AdminLayout({ children }: AdminLayoutProps) {
  await requireConvexAdmin();

  return children;
}
