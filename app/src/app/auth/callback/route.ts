import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Google OAuth redirect target: exchanges the auth code for a session cookie,
// then hands off to "/" — middleware takes it from there (admin → /admin,
// everyone else → /dashboard).
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}/`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth`);
}
