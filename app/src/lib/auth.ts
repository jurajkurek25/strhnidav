import "server-only";
import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { profiles } from "@/lib/db/schema";
import { hasActiveSubscription } from "@/lib/subscriptions";

type Profile = typeof profiles.$inferSelect;
export type ProfileWithAccess = Profile & {
  /**
   * hasFullAccess OR a live subscription. profiles.hasFullAccess itself is
   * never touched by subscription state (see src/lib/subscriptions.ts) —
   * use this field instead of the raw column for any access/redirect/
   * eligibility decision. The admin panel's "Prístup" toggle intentionally
   * keeps reading the raw column, since that's a separate, permanent grant.
   */
  effectiveFullAccess: boolean;
};

/** Redirects to /login if not authenticated, otherwise returns the profile row. */
export async function requireProfile(): Promise<ProfileWithAccess> {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const profile = await db.query.profiles.findFirst({
    where: eq(profiles.id, session.user.id),
  });

  // Session cookie outlived the profile row (e.g. deleted directly in the
  // DB) — force a fresh sign-in, which re-creates it via src/auth.ts's jwt
  // callback.
  if (!profile) redirect("/login");

  const effectiveFullAccess = profile.hasFullAccess || (await hasActiveSubscription(profile.id));

  return { ...profile, effectiveFullAccess };
}

/** Redirects non-admins to /dashboard. Use at the top of every /admin page. */
export async function requireAdmin(): Promise<ProfileWithAccess> {
  const profile = await requireProfile();
  if (!profile.isAdmin) redirect("/dashboard");
  return profile;
}
