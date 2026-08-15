import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getLessonAccess } from "@/lib/course";

const Body = z.object({
  actionStepId: z.string().uuid(),
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
  const { actionStepId, completed } = parsed.data;

  const { data: step } = await supabase
    .from("action_steps")
    .select("lesson_id")
    .eq("id", actionStepId)
    .single();
  if (!step) return NextResponse.json({ error: "not found" }, { status: 404 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("has_full_access")
    .eq("id", user.id)
    .single();

  const { allowed } = await getLessonAccess(
    supabase,
    user.id,
    step.lesson_id,
    profile?.has_full_access ?? false
  );
  if (!allowed) return NextResponse.json({ error: "locked" }, { status: 403 });

  const admin = createAdminClient();
  if (completed) {
    await admin
      .from("user_action_step_completions")
      .upsert(
        { user_id: user.id, action_step_id: actionStepId },
        { onConflict: "user_id,action_step_id" }
      );
  } else {
    await admin
      .from("user_action_step_completions")
      .delete()
      .eq("user_id", user.id)
      .eq("action_step_id", actionStepId);
  }

  return NextResponse.json({ ok: true });
}
