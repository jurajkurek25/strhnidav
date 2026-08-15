import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

type Client = SupabaseClient<Database>;

/**
 * Merges a partial progress update for (user, lesson) and recomputes
 * `completed_at`. `completed_at` is the single timestamp the whole gating
 * chain (lib/gating.ts) hangs off of, so it must only ever be set once both
 * the video and the task are actually done — never earlier.
 */
export async function upsertLessonProgress(
  supabase: Client,
  userId: string,
  lessonId: string,
  patch: {
    videoWatchedPercent?: number;
    videoCompleted?: boolean;
    taskCompleted?: boolean;
  }
) {
  const { data: existing } = await supabase
    .from("user_lesson_progress")
    .select("*")
    .eq("user_id", userId)
    .eq("lesson_id", lessonId)
    .maybeSingle();

  const now = new Date().toISOString();

  const videoCompletedAt =
    patch.videoCompleted && !existing?.video_completed_at
      ? now
      : existing?.video_completed_at ?? null;

  const taskCompletedAt =
    patch.taskCompleted && !existing?.task_completed_at
      ? now
      : existing?.task_completed_at ?? null;

  const completedAt =
    existing?.completed_at ?? (videoCompletedAt && taskCompletedAt ? now : null);

  const row = {
    user_id: userId,
    lesson_id: lessonId,
    video_watched_percent: Math.max(
      patch.videoWatchedPercent ?? 0,
      existing?.video_watched_percent ?? 0
    ),
    video_completed_at: videoCompletedAt,
    task_completed_at: taskCompletedAt,
    completed_at: completedAt,
    updated_at: now,
  };

  const { error } = await supabase
    .from("user_lesson_progress")
    .upsert(row, { onConflict: "user_id,lesson_id" });

  if (error) throw error;
  return row;
}
