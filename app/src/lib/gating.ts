import type { Database } from "@/types/database";

type Lesson = Database["public"]["Tables"]["lessons"]["Row"];
type Progress = Database["public"]["Tables"]["user_lesson_progress"]["Row"];

export type LessonState =
  | "completed" // video watched + task approved
  | "unlocked" // available to watch/work on right now
  | "locked_time" // previous lesson not finished yet, or the 1-day wait hasn't elapsed
  | "locked_paywall"; // time-unlocked but lessons 8+ require the 199€ purchase

export interface LessonWithState {
  lesson: Lesson;
  progress: Progress | null;
  state: LessonState;
  /** When state === "locked_time" and a previous lesson IS done, this is when it opens. */
  unlocksAt: Date | null;
}

/**
 * The next lesson opens on the calendar day *after* the previous one was
 * completed — never sooner. Waiting extra days before finishing a lesson
 * does not "bank" unlocks: only the single next lesson becomes available,
 * and every lesson after that still needs its own video+task completion
 * before its own successor's one-day timer even starts.
 */
function nextDayUnlock(completedAt: string): Date {
  const d = new Date(completedAt);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 1);
  return d;
}

/**
 * Walks the course in day_number order, computing each lesson's state from
 * the previous lesson's progress. `lessons` must already be sorted ascending
 * by day_number and `progressByLessonId` should contain every progress row
 * the caller has for this user.
 */
export function computeLessonStates(
  lessons: Lesson[],
  progressByLessonId: Map<string, Progress>,
  hasFullAccess: boolean
): LessonWithState[] {
  const result: LessonWithState[] = [];
  let prevCompletedAt: string | null = null;
  let chainBroken = false; // true once we hit a lesson that isn't completed yet

  for (const lesson of lessons) {
    const progress = progressByLessonId.get(lesson.id) ?? null;
    const isCompleted = Boolean(progress?.completed_at);

    let state: LessonState;
    let unlocksAt: Date | null = null;

    if (prevCompletedAt === null && !chainBroken) {
      // First lesson in the course: always available immediately.
      state = isCompleted ? "completed" : "unlocked";
    } else if (chainBroken) {
      state = "locked_time";
    } else {
      const openAt = nextDayUnlock(prevCompletedAt as string);
      if (new Date() < openAt) {
        state = "locked_time";
        unlocksAt = openAt;
      } else if (!lesson.is_free && !hasFullAccess) {
        state = "locked_paywall";
      } else {
        state = isCompleted ? "completed" : "unlocked";
      }
    }

    result.push({ lesson, progress, state, unlocksAt });

    if (isCompleted) {
      prevCompletedAt = progress!.completed_at;
    } else {
      // Whether this lesson is open, paywalled, or time-locked, nothing
      // after it can unlock until *this* one is actually completed.
      chainBroken = true;
    }
  }

  return result;
}

/** Convenience for a single lesson lookup, e.g. `states.get(dayNumber)`. */
export function statesByDayNumber(
  states: LessonWithState[]
): Map<number, LessonWithState> {
  return new Map(states.map((s) => [s.lesson.day_number, s]));
}
