import "server-only";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { profiles, emailNotifications, type EmailNotificationKind } from "@/lib/db/schema";
import { getLessonStatesForUser } from "@/lib/course";
import { nextDayUnlock } from "@/lib/gating";
import { sendEmail } from "@/lib/email";
import { unlockEmail, nudgeEmail } from "@/lib/email-templates";

const NUDGE_AFTER_DAYS = 3;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

async function alreadyNotified(userId: string, lessonId: string, kind: EmailNotificationKind) {
  const existing = await db.query.emailNotifications.findFirst({
    where: and(
      eq(emailNotifications.userId, userId),
      eq(emailNotifications.lessonId, lessonId),
      eq(emailNotifications.kind, kind)
    ),
  });
  return Boolean(existing);
}

async function recordNotification(userId: string, lessonId: string, kind: EmailNotificationKind) {
  // onConflictDoNothing guards the same race the unique constraint exists
  // for: two overlapping cron runs racing to send the same email.
  await db
    .insert(emailNotifications)
    .values({ userId, lessonId, kind })
    .onConflictDoNothing({ target: [emailNotifications.userId, emailNotifications.lessonId, emailNotifications.kind] });
}

/**
 * Runs once daily (triggered by an external cron hitting
 * /api/cron/daily-digest, since this is a self-hosted VPS with no job
 * queue). For every member, finds their single next "unlocked but not yet
 * completed" lesson and:
 *   - sends the "it's unlocked" email exactly once, the day it unlocks
 *   - sends one gentle nudge if it's still not started after
 *     NUDGE_AFTER_DAYS
 * Day 1 (no prior lesson driving its unlock) is intentionally skipped —
 * it's available immediately at signup, not part of the daily-unlock drip.
 */
export async function runDailyDigest() {
  const allProfiles = await db.select().from(profiles);
  let unlockSent = 0;
  let nudgeSent = 0;

  for (const profile of allProfiles) {
    if (!profile.email) continue;

    const states = await getLessonStatesForUser(profile.id, profile.hasFullAccess);
    const idx = states.findIndex((s) => s.state === "unlocked");
    if (idx <= 0) continue; // no unlocked lesson, or it's day 1

    const target = states[idx];
    const prev = states[idx - 1];
    if (!prev.progress?.completedAt) continue;

    const unlockedAt = nextDayUnlock(prev.progress.completedAt);
    const daysSinceUnlock = Math.floor((Date.now() - unlockedAt.getTime()) / MS_PER_DAY);
    if (daysSinceUnlock < 0) continue;

    const firstName = profile.fullName?.split(" ")[0] ?? "";

    if (daysSinceUnlock === 0) {
      if (await alreadyNotified(profile.id, target.lesson.id, "unlock")) continue;
      const { subject, html, text } = unlockEmail({
        firstName,
        dayNumber: target.lesson.dayNumber,
        lessonTitle: target.lesson.title,
      });
      const sent = await sendEmail({ to: profile.email, subject, html, text });
      if (sent) {
        await recordNotification(profile.id, target.lesson.id, "unlock");
        unlockSent++;
      }
    } else if (daysSinceUnlock >= NUDGE_AFTER_DAYS) {
      if (await alreadyNotified(profile.id, target.lesson.id, "nudge")) continue;
      const { subject, html, text } = nudgeEmail({
        firstName,
        dayNumber: target.lesson.dayNumber,
        lessonTitle: target.lesson.title,
      });
      const sent = await sendEmail({ to: profile.email, subject, html, text });
      if (sent) {
        await recordNotification(profile.id, target.lesson.id, "nudge");
        nudgeSent++;
      }
    }
  }

  return { checked: allProfiles.length, unlockSent, nudgeSent };
}
