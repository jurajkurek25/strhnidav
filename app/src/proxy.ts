import NextAuth from "next-auth";
import { NextResponse } from "next/server";
import { authConfig } from "@/auth.config";

const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? "jurajkurek2006@gmail.com";
const PROTECTED_PREFIXES = ["/dashboard", "/lesson", "/admin", "/buy"];

// Edge-safe: instantiated from authConfig only (no Google provider secrets,
// no Drizzle/pg import — Postgres needs the Node.js runtime). Reads the
// signed session JWT straight out of the cookie; no DB call happens here.
const { auth } = NextAuth(authConfig);

export const proxy = auth((request) => {
  const { pathname } = request.nextUrl;
  const user = request.auth?.user;
  const isAdmin = user?.email === ADMIN_EMAIL;
  const isProtected = PROTECTED_PREFIXES.some((p) => pathname.startsWith(p));

  if (isProtected && !user) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  // The admin account always lands in /admin, never the customer dashboard.
  if (user && isAdmin && pathname.startsWith("/dashboard")) {
    const url = request.nextUrl.clone();
    url.pathname = "/admin";
    return NextResponse.redirect(url);
  }

  // Non-admins can't reach the admin panel.
  if (user && !isAdmin && pathname.startsWith("/admin")) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }

  // An already-authenticated user hitting "/" or "/login" (e.g. after a
  // refresh, or a cached tab) lands on their real destination instead of
  // re-showing the login form.
  if ((pathname === "/" || pathname === "/login") && user) {
    const url = request.nextUrl.clone();
    url.pathname = isAdmin ? "/admin" : "/dashboard";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
