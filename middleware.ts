import { auth } from "@/auth";

export default auth((req) => {
  // TODO: find out if there's a better way
  const protectedRoutes = [
    "/sound",
    "/dashboard",
  ];

  if (!req.auth && protectedRoutes.includes(req.nextUrl.pathname)) {
    const newUrl = new URL("/login", req.nextUrl.origin);
    return Response.redirect(newUrl);
  }
});

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)"
  ],
};