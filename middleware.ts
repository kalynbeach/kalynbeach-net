import type { NextRequest } from "next/server";
import { updateSession } from "@/db/supabase/middleware";

export async function middleware(request: NextRequest) {
  console.log("[middleware] path:", request.nextUrl.pathname);
  return await updateSession(request);
}

export const config = {
  matcher: [
    "/auth/:path*",
    "/dashboard/:path*",
    "/login/:path*",
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - sitemap.xml (sitemap file)
     * - robots.txt (robots file)
     * - any other static files
     * Feel free to modify this pattern to include more paths.
     */
    // '/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
