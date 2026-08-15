import { NextResponse } from "next/server";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { actionSteps, profiles, userActionStepCompletions } from "@/lib/db/schema";
import { getLessonAccess } from "@/lib/course";

const Body = z.object({
  actionStepId: z.string().uuid(),
  completed: z.boolean(),
});

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const userId = session.user.id;

  const parsed = Body.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: "invalid body" }, { status: 400 });
  const { actionStepId, completed } = parsed.data;

  const [step] = await db
    .select({ lessonId: actionSteps.lessonId })
    .from(actionSteps)
    .where(eq(actionSteps.id, actionStepId));
  if (!step) return NextResponse.json({ error: "not found" }, { status: 404 });

  const [profile] = await db
    .select({ hasFullAccess: profiles.hasFullAccess })
    .from(profiles)
    .where(eq(profiles.id, userId));

  const { allowed } = await getLessonAccess(userId, step.lessonId, profile?.hasFullAccess ?? false);
  if (!allowed) return NextResponse.json({ error: "locked" }, { status: 403 });

  if (completed) {
    await db
      .insert(userActionStepCompletions)
      .values({ userId, actionStepId })
      .onConflictDoNothing({ target: [userActionStepCompletions.userId, userActionStepCompletions.actionStepId] });
  } else {
    await db
      .delete(userActionStepCompletions)
      .where(and(eq(userActionStepCompletions.userId, userId), eq(userActionStepCompletions.actionStepId, actionStepId)));
  }

  return NextResponse.json({ ok: true });
}
