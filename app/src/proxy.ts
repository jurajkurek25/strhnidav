import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? "jurajkurek2006@gmail.com";
const PROTECTED_PREFIXES = ["/dashboard", "/lesson", "/admin"];

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  // TEMPORARY diagnostic logging — remove once the refresh→login-redirect
  // issue is diagnosed. Check with `pm2 logs strhnidav`.
  console.log("[proxy]", {
    pathname: request.nextUrl.pathname,
    hasCookie: request.cookies.getAll().some((c) => c.name.startsWith("sb-") && c.name.includes("auth-token")),
    cookieNames: request.cookies.getAll().map((c) => c.name),
    user: user ? { id: user.id, email: user.email } : null,
    userError: userError ? { message: userError.message, status: userError.status, name: userError.name } : null,
  });

  const { pathname } = request.nextUrl;
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

  if (pathname === "/" && user) {
    const url = request.nextUrl.clone();
    url.pathname = isAdmin ? "/admin" : "/dashboard";
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
