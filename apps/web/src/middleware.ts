import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

const COOKIES = ["avadesk_session", "nexus_session"];

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const session = COOKIES.some((name) => Boolean(req.cookies.get(name)?.value));

  if (pathname === "/portal" || pathname.startsWith("/portal/")) {
    const url = req.nextUrl.clone();
    url.pathname = pathname.replace(/^\/portal/, "/client") || "/client";
    return NextResponse.redirect(url);
  }

  const needsAuth = pathname.startsWith("/client") || pathname.startsWith("/admin");

  if (needsAuth && !session) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/client/:path*", "/portal/:path*", "/login"],
};
