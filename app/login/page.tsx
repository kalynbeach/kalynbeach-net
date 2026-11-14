import { SignIn } from "@clerk/nextjs";
import { pageMetadata, signIn } from "@/lib/site";

export const metadata = pageMetadata("/login");

export default function Login() {
  // The shell's "Sign in" is the page's h1, on the top line. Clerk's title is a
  // second h1 and no option turns it off, so it is hidden. Its subtitle and
  // the email preview with its edit link stay.
  return (
    <SignIn
      routing="hash"
      fallbackRedirectUrl={signIn.lands}
      appearance={{ elements: { headerTitle: { display: "none" } } }}
    />
  );
}
