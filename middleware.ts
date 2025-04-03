import type { NextRequest } from "next/server";
import { updateSession } from "@/db/supabase/middleware";

export async function middleware(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
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
    '/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}

// export default auth((req) => {
//   // TODO: find out if there's a better way
//   const protectedRoutes = [
//     "/sound", // TEMP: remove once specific sound route pages/components are protected
//     "/dashboard",
//     "/lab",
//   ];

//   if (!req.auth && protectedRoutes.includes(req.nextUrl.pathname)) {
//     const newUrl = new URL("/login", req.nextUrl.origin);
//     return Response.redirect(newUrl);
//   }
// });

// export const config = {
//   matcher: [
//     "/((?!api|_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)"
//   ],
// };