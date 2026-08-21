import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { certificates } from "@/lib/db/schema";
import { getLessonStatesForUser } from "@/lib/course";

/** Full paid course = every lesson completed, on an account with full access. */
export async function hasCompletedFullCourse(
  userId: string,
  hasFullAccess: boolean
): Promise<boolean> {
  if (!hasFullAccess) return false;
  const states = await getLessonStatesForUser(userId, hasFullAccess);
  return states.length > 0 && states.every((s) => s.state === "completed");
}

/**
 * Idempotent: returns the existing certificate if this user already has
 * one, otherwise issues a new one. Never overwrites an existing row (the
 * unique constraint on user_id plus onConflictDoNothing means a race
 * between two concurrent requests still only ever produces one certificate).
 */
export async function getOrIssueCertificate(userId: string, fullName: string) {
  const [created] = await db
    .insert(certificates)
    .values({ userId, fullName })
    .onConflictDoNothing({ target: certificates.userId })
    .returning();

  if (created) return created;

  const existing = await db.query.certificates.findFirst({
    where: eq(certificates.userId, userId),
  });
  return existing!;
}

export async function getCertificateById(id: string) {
  // certificates.id is a uuid column — an invalid uuid string would throw
  // at the driver level instead of returning "not found", so guard it here.
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    return null;
  }
  return (await db.query.certificates.findFirst({ where: eq(certificates.id, id) })) ?? null;
}
