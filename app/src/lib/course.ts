import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { computeLessonStates, type LessonWithState } from "@/lib/gating";

export { statesByDayNumber } from "@/lib/gating";

type Client = SupabaseClient<Database>;

export async function getLessonStatesForUser(
  supabase: Client,
  userId: string,
  hasFullAccess: boolean
): Promise<LessonWithState[]> {
  const [{ data: lessons }, { data: progress }] = await Promise.all([
    supabase.from("lessons").select("*").order("day_number", { ascending: true }),
    supabase.from("user_lesson_progress").select("*").eq("user_id", userId),
  ]);

  const progressByLessonId = new Map(
    (progress ?? []).map((p) => [p.lesson_id, p])
  );

  return computeLessonStates(lessons ?? [], progressByLessonId, hasFullAccess);
}

/**
 * Authorization check for a single lesson — used by every API route that
 * serves lesson media or accepts a task submission, so access can never be
 * granted just because the UI happened to render a page.
 */
export async function getLessonAccess(
  supabase: Client,
  userId: string,
  lessonId: string,
  hasFullAccess: boolean
): Promise<{ allowed: boolean; state: LessonWithState | null }> {
  const states = await getLessonStatesForUser(supabase, userId, hasFullAccess);
  const entry = states.find((s) => s.lesson.id === lessonId) ?? null;
  if (!entry) return { allowed: false, state: null };
  const allowed = entry.state === "unlocked" || entry.state === "completed";
  return { allowed, state: entry };
}
