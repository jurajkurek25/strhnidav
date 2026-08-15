import "server-only";
import { asc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { lessons, userLessonProgress } from "@/lib/db/schema";
import { computeLessonStates, type LessonWithState } from "@/lib/gating";

export { statesByDayNumber } from "@/lib/gating";

export async function getLessonStatesForUser(
  userId: string,
  hasFullAccess: boolean
): Promise<LessonWithState[]> {
  const [allLessons, progress] = await Promise.all([
    db.select().from(lessons).orderBy(asc(lessons.dayNumber)),
    db.select().from(userLessonProgress).where(eq(userLessonProgress.userId, userId)),
  ]);

  const progressByLessonId = new Map(progress.map((p) => [p.lessonId, p]));

  return computeLessonStates(allLessons, progressByLessonId, hasFullAccess);
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
