import "server-only";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/types/database";

type Profile = Database["public"]["Tables"]["profiles"]["Row"];

const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? "jurajkurek2006@gmail.com";

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

  if (profile) return profile;

  // The on_auth_user_created trigger only fires on INSERT into auth.users,
  // i.e. the person's very first sign-in — so anyone whose auth.users row
  // predates the trigger (or who slipped through some other gap) would
  // otherwise be stuck bouncing to /login forever. Self-heal by creating
  // the row here via the service-role client (the RLS-scoped client above
  // has no insert policy on profiles by design).
  const admin = createAdminClient();
  const { data: created } = await admin
    .from("profiles")
    .upsert(
      {
        id: user.id,
        email: user.email!,
        full_name: (user.user_metadata?.full_name as string | undefined) ?? null,
        avatar_url: (user.user_metadata?.avatar_url as string | undefined) ?? null,
        is_admin: user.email === ADMIN_EMAIL,
      },
      { onConflict: "id" }
    )
    .select()
    .single();

  if (!created) redirect("/login");

  return created;
}

/** Redirects non-admins to /dashboard. Use at the top of every /admin page. */
export async function requireAdmin(): Promise<Profile> {
  const profile = await requireProfile();
  if (!profile.is_admin) redirect("/dashboard");
  return profile;
}
