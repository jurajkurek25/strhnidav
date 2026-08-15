import "server-only";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";

type Profile = Database["public"]["Tables"]["profiles"]["Row"];

/** Redirects to /login if not authenticated, otherwise returns the profile row. */
export async function requireProfile(): Promise<Profile> {
  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (!user) {
    // TEMPORARY diagnostic — remove once the refresh→login-redirect bug is
    // confirmed fixed. Check with `pm2 logs strhnidav`.
    console.log("[requireProfile] redirecting: no user", {
      userError: userError ? { message: userError.message, status: userError.status } : null,
    });
    redirect("/login");
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  // The DB trigger creates this row on first sign-in; this is only a
  // defensive fallback in case it hasn't landed yet.
  if (!profile) {
    console.log("[requireProfile] redirecting: no profile row", {
      userId: user.id,
      email: user.email,
      profileError: profileError
        ? { message: profileError.message, code: profileError.code, details: profileError.details }
        : null,
    });
    redirect("/login");
  }

  return profile;
}

/** Redirects non-admins to /dashboard. Use at the top of every /admin page. */
export async function requireAdmin(): Promise<Profile> {
  const profile = await requireProfile();
  if (!profile.is_admin) redirect("/dashboard");
  return profile;
}
