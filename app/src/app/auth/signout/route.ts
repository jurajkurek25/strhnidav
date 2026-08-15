import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  // Not `new URL("/login", request.url)` — behind the CloudPanel/Nginx
  // reverse proxy the Node process sees the request as arriving at its own
  // local address (http://localhost:7777), not the public domain. Same fix
  // as login/page.tsx and auth/callback/route.ts.
  return NextResponse.redirect(`${process.env.NEXT_PUBLIC_SITE_URL}/login`);
}
