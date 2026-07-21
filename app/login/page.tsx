import { SignIn } from "@clerk/nextjs";
import { auth } from "@clerk/nextjs/server";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import SitePage from "@/components/site/site-page";

export const metadata: Metadata = {
  title: "login",
};

export default async function Login() {
  const { userId } = await auth();

  if (userId) {
    redirect("/dashboard");
  }

  return (
    <SitePage>
      <main className="flex size-full flex-col items-center justify-center gap-4">
        <SignIn routing="hash" fallbackRedirectUrl="/dashboard" />
      </main>
    </SitePage>
  );
}
