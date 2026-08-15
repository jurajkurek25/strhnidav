import "server-only";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { userLessonProgress } from "@/lib/db/schema";

/**
 * Merges a partial progress update for (user, lesson) and recomputes
 * `completedAt`. `completedAt` is the single timestamp the whole gating
 * chain (lib/gating.ts) hangs off of, so it must only ever be set once both
 * the video and the task are actually done — never earlier.
 */
export async function upsertLessonProgress(
  userId: string,
  lessonId: string,
  patch: {
    videoWatchedPercent?: number;
    videoCompleted?: boolean;
    taskCompleted?: boolean;
  }
) {
  const existing = await db.query.userLessonProgress.findFirst({
    where: and(eq(userLessonProgress.userId, userId), eq(userLessonProgress.lessonId, lessonId)),
  });

  const now = new Date();

  const videoCompletedAt =
    patch.videoCompleted && !existing?.videoCompletedAt ? now : existing?.videoCompletedAt ?? null;

  const taskCompletedAt =
    patch.taskCompleted && !existing?.taskCompletedAt ? now : existing?.taskCompletedAt ?? null;

  const completedAt =
    existing?.completedAt ?? (videoCompletedAt && taskCompletedAt ? now : null);

  const row = {
    userId,
    lessonId,
    videoWatchedPercent: Math.max(patch.videoWatchedPercent ?? 0, existing?.videoWatchedPercent ?? 0),
    videoCompletedAt,
    taskCompletedAt,
    completedAt,
    updatedAt: now,
  };

  await db
    .insert(userLessonProgress)
    .values(row)
    .onConflictDoUpdate({
      target: [userLessonProgress.userId, userLessonProgress.lessonId],
      set: row,
    });

  return row;
}
