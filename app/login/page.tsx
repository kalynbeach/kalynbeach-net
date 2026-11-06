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

  // The shell's "Sign in" is the page's h1, on the top line. Clerk's title is a
  // second h1 and no option turns it off, so it is hidden. Its subtitle and
  // the email preview with its edit link stay.
  return (
    <SignIn
      routing="hash"
      fallbackRedirectUrl="/dashboard"
      appearance={{ elements: { headerTitle: { display: "none" } } }}
    />
  );
}
