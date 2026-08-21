import { NextResponse } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { profiles } from "@/lib/db/schema";
import { getLessonAccess } from "@/lib/course";
import { upsertLessonProgress } from "@/lib/progress";

const Body = z.object({
  lessonId: z.string().uuid(),
  percent: z.number().min(0).max(100),
  completed: z.boolean(),
});

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const userId = session.user.id;

  const parsed = Body.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: "invalid body" }, { status: 400 });
  const { lessonId, percent, completed } = parsed.data;

  const [profile] = await db.select({ hasFullAccess: profiles.hasFullAccess }).from(profiles).where(eq(profiles.id, userId));

  const { allowed } = await getLessonAccess(userId, lessonId, profile?.hasFullAccess ?? false);
  if (!allowed) return NextResponse.json({ error: "locked" }, { status: 403 });

  await upsertLessonProgress(userId, lessonId, {
    videoWatchedPercent: percent,
    videoCompleted: completed,
  });

  return NextResponse.json({ ok: true });
}
