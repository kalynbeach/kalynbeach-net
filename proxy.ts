import { clerkMiddleware } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { gate } from "@/lib/site";

/**
 * The rewrite target for a 404. Next's router drops a rewrite's status,
 * so it goes to a path no route matches, which Next answers with
 * app/not-found.tsx and a 404. A `_` folder is private in the App Router,
 * and tests/site.test.ts checks that no root-level dynamic segment could
 * match it.
 */
const UNMATCHED = "/_unserved";

/**
 * Under Cache Components a page's status is sent before its code runs, so
 * every status that depends on the visitor or the deployment is set here.
 * Next strips the Flight headers from `request`, so document, RSC and
 * prefetch requests get the same answer.
 */
export default clerkMiddleware(async (auth, request) => {
  const { isAuthenticated } = await auth();
  const decision = gate(request.nextUrl.pathname, isAuthenticated);

  switch (decision.kind) {
    case "pass":
      return NextResponse.next();
    case "redirect":
      return NextResponse.redirect(new URL(decision.to, request.url));
    case "not-found":
      return NextResponse.rewrite(new URL(UNMATCHED, request.url));
  }
});

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
    // A slug that looks like a file, such as /software/no-such.js, still
    // needs its 404. tests/site.test.ts checks every dynamic route is here.
    "/software/:path*",
  ],
};
