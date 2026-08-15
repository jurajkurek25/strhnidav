import "server-only";
import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { profiles } from "@/lib/db/schema";

type Profile = typeof profiles.$inferSelect;

/** Redirects to /login if not authenticated, otherwise returns the profile row. */
export async function requireProfile(): Promise<Profile> {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const profile = await db.query.profiles.findFirst({
    where: eq(profiles.id, session.user.id),
  });

  // Session cookie outlived the profile row (e.g. deleted directly in the
  // DB) — force a fresh sign-in, which re-creates it via src/auth.ts's jwt
  // callback.
  if (!profile) redirect("/login");

  return profile;
}

/** Redirects non-admins to /dashboard. Use at the top of every /admin page. */
export async function requireAdmin(): Promise<Profile> {
  const profile = await requireProfile();
  if (!profile.isAdmin) redirect("/dashboard");
  return profile;
}
