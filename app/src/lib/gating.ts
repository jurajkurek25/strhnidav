import type { lessons, userLessonProgress } from "@/lib/db/schema";

type Lesson = typeof lessons.$inferSelect;
type Progress = typeof userLessonProgress.$inferSelect;

export type LessonState =
  | "completed" // video watched + task approved
  | "unlocked" // available to watch/work on right now
  | "locked_time" // previous lesson not finished yet, or the 1-day wait hasn't elapsed
  | "locked_paywall"; // time-unlocked but lessons 8+ require the 299€ purchase

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
export function nextDayUnlock(completedAt: Date): Date {
  const d = new Date(completedAt);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 1);
  return d;
}

interface ChainResult {
  state: LessonState;
  unlocksAt: Date | null;
}

/**
 * Walks a single ordered subsequence of lessons, computing each one's state
 * from the previous entry *in that subsequence* — not from whatever lesson
 * happens to sit next to it in the full course. This is the shared engine
 * behind both tracks in computeLessonStates below.
 */
function walkChain(
  trackLessons: Lesson[],
  progressByLessonId: Map<string, Progress>,
  hasFullAccess: boolean,
  purchasedSectionIds: Set<string>
): Map<string, ChainResult> {
  const result = new Map<string, ChainResult>();
  let prevCompletedAt: Date | null = null;
  let chainBroken = false; // true once we hit a lesson that isn't completed yet

  for (const lesson of trackLessons) {
    const progress = progressByLessonId.get(lesson.id) ?? null;
    const isCompleted = Boolean(progress?.completedAt);

    let state: LessonState;
    let unlocksAt: Date | null = null;

    if (prevCompletedAt === null && !chainBroken) {
      // First lesson in this track: always available immediately.
      state = isCompleted ? "completed" : "unlocked";
    } else if (chainBroken) {
      state = "locked_time";
    } else {
      const openAt = nextDayUnlock(prevCompletedAt as Date);
      if (new Date() < openAt) {
        state = "locked_time";
        unlocksAt = openAt;
      } else if (
        !lesson.isFree &&
        !hasFullAccess &&
        !(lesson.sectionId && purchasedSectionIds.has(lesson.sectionId))
      ) {
        state = "locked_paywall";
      } else {
        state = isCompleted ? "completed" : "unlocked";
      }
    }

    result.set(lesson.id, { state, unlocksAt });

    if (isCompleted) {
      prevCompletedAt = progress!.completedAt;
    } else {
      // Whether this lesson is open, paywalled, or time-locked, nothing
      // after it (in this same track) can unlock until *this* one is
      // actually completed.
      chainBroken = true;
    }
  }

  return result;
}

/**
 * Computes every lesson's state from two independent day-by-day chains:
 *
 * - The full course, in day_number order — this is what paid lessons gate
 *   on, exactly as before. Reaching a paid lesson still requires every
 *   lesson before it (free or paid) to be completed in order.
 * - The free lessons alone, in their own day_number order — this is what
 *   free lessons gate on, so a free lesson scheduled after an unpurchased
 *   paid one (e.g. a free bonus lesson on day 25) is never trapped behind
 *   it. It only waits on the free lesson before *it*, one day at a time,
 *   same as any other lesson.
 *
 * `courseLessons` must already be sorted ascending by dayNumber and
 * `progressByLessonId` should contain every progress row the caller has for
 * this user.
 */
export function computeLessonStates(
  courseLessons: Lesson[],
  progressByLessonId: Map<string, Progress>,
  hasFullAccess: boolean,
  purchasedSectionIds: Set<string> = new Set()
): LessonWithState[] {
  const mainChain = walkChain(courseLessons, progressByLessonId, hasFullAccess, purchasedSectionIds);
  const freeChain = walkChain(
    courseLessons.filter((l) => l.isFree),
    progressByLessonId,
    hasFullAccess,
    purchasedSectionIds
  );

  return courseLessons.map((lesson) => {
    const progress = progressByLessonId.get(lesson.id) ?? null;
    const { state, unlocksAt } = (lesson.isFree ? freeChain : mainChain).get(lesson.id)!;
    return { lesson, progress, state, unlocksAt };
  });
}

/** Convenience for a single lesson lookup, e.g. `states.get(dayNumber)`. */
export function statesByDayNumber(
  states: LessonWithState[]
): Map<number, LessonWithState> {
  return new Map(states.map((s) => [s.lesson.dayNumber, s]));
}
