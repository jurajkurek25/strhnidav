import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getLessonAccess } from "@/lib/course";
import { upsertLessonProgress } from "@/lib/progress";

const Body = z.object({
  lessonId: z.string().uuid(),
  percent: z.number().min(0).max(100),
  completed: z.boolean(),
});

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const parsed = Body.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: "invalid body" }, { status: 400 });
  const { lessonId, percent, completed } = parsed.data;

  const { data: profile } = await supabase
    .from("profiles")
    .select("has_full_access")
    .eq("id", user.id)
    .single();

  const { allowed } = await getLessonAccess(supabase, user.id, lessonId, profile?.has_full_access ?? false);
  if (!allowed) return NextResponse.json({ error: "locked" }, { status: 403 });

  const admin = createAdminClient();
  await upsertLessonProgress(admin, user.id, lessonId, {
    videoWatchedPercent: percent,
    videoCompleted: completed,
  });

  return NextResponse.json({ ok: true });
}
