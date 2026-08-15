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
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  // The DB trigger creates this row on first sign-in; this is only a
  // defensive fallback in case it hasn't landed yet.
  if (!profile) redirect("/login");

  return profile;
}

/** Redirects non-admins to /dashboard. Use at the top of every /admin page. */
export async function requireAdmin(): Promise<Profile> {
  const profile = await requireProfile();
  if (!profile.is_admin) redirect("/dashboard");
  return profile;
}
