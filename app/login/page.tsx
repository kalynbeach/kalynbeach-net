import { SignIn } from "@clerk/nextjs";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { pageMetadata } from "@/lib/site";

export const metadata = pageMetadata("/login");

export default async function Login() {
  const { userId } = await auth();

  if (userId) {
    redirect("/dashboard");
  }

  return <SignIn routing="hash" fallbackRedirectUrl="/dashboard" />;
}
