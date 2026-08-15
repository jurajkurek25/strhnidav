import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Google OAuth redirect target: exchanges the auth code for a session cookie,
// then hands off to "/" — middleware takes it from there (admin → /admin,
// everyone else → /dashboard).
export async function GET(request: Request) {
  // NOT `new URL(request.url).origin` — behind a reverse proxy (CloudPanel/
  // Nginx) the Node process sees the request as arriving at its own local
  // address (e.g. http://localhost:7777), not the public domain, so that
  // would redirect the browser straight to localhost. NEXT_PUBLIC_SITE_URL
  // is the one trusted public URL, same as login/page.tsx uses.
  const site = process.env.NEXT_PUBLIC_SITE_URL!;
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${site}/`);
    }
  }

  return NextResponse.redirect(`${site}/login?error=auth`);
}
