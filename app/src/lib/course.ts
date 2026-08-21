import "server-only";
import { asc, and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { lessons, userLessonProgress, sectionPurchases, profiles } from "@/lib/db/schema";
import { computeLessonStates, type LessonWithState } from "@/lib/gating";
import { hasActiveSubscription } from "@/lib/subscriptions";

export { statesByDayNumber } from "@/lib/gating";

export async function getLessonStatesForUser(
  userId: string,
  hasFullAccess: boolean
): Promise<LessonWithState[]> {
  // A live subscription grants the same access as hasFullAccess without
  // that ever being written to profiles.hasFullAccess itself — see
  // src/lib/subscriptions.ts for why.
  const effectiveFullAccess = hasFullAccess || (await hasActiveSubscription(userId));

  const [allLessons, progress, purchasedSections, profileRows] = await Promise.all([
    db.select().from(lessons).orderBy(asc(lessons.dayNumber)),
    db.select().from(userLessonProgress).where(eq(userLessonProgress.userId, userId)),
    // Full access already unlocks everything, so skip the lookup.
    effectiveFullAccess
      ? Promise.resolve([])
      : db
          .select({ sectionId: sectionPurchases.sectionId })
          .from(sectionPurchases)
          .where(and(eq(sectionPurchases.userId, userId), eq(sectionPurchases.status, "paid"))),
    db.select({ audiencePreference: profiles.audiencePreference }).from(profiles).where(eq(profiles.id, userId)),
  ]);

  const progressByLessonId = new Map(progress.map((p) => [p.lessonId, p]));
  const purchasedSectionIds = new Set(purchasedSections.map((s) => s.sectionId));
  const audiencePreference = profileRows[0]?.audiencePreference ?? null;

  return computeLessonStates(
    allLessons,
    progressByLessonId,
    effectiveFullAccess,
    purchasedSectionIds,
    audiencePreference
  );
}

/**
 * Authorization check for a single lesson — used by every API route that
 * serves lesson media or accepts a task submission, so access can never be
 * granted just because the UI happened to render a page.
 */
export async function getLessonAccess(
  userId: string,
  lessonId: string,
  hasFullAccess: boolean
): Promise<{ allowed: boolean; state: LessonWithState | null }> {
  const states = await getLessonStatesForUser(userId, hasFullAccess);
  const entry = states.find((s) => s.lesson.id === lessonId) ?? null;
  if (!entry) return { allowed: false, state: null };
  const allowed = entry.state === "unlocked" || entry.state === "completed";
  return { allowed, state: entry };
}
