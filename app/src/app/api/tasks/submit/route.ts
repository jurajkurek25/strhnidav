import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getLessonAccess } from "@/lib/course";
import { upsertLessonProgress } from "@/lib/progress";
import { gradeTextSubmission, gradeFileSubmission } from "@/lib/ai-grading";
import { uploadToBucket } from "@/lib/media";

const MAX_FILE_BYTES = 8 * 1024 * 1024;

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const form = await request.formData();
  const lessonId = form.get("lessonId");
  if (typeof lessonId !== "string") {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("has_full_access")
    .eq("id", user.id)
    .single();

  const { allowed } = await getLessonAccess(supabase, user.id, lessonId, profile?.has_full_access ?? false);
  if (!allowed) return NextResponse.json({ error: "locked" }, { status: 403 });

  const { data: lesson } = await supabase
    .from("lessons")
    .select("id, title, task_type, task_prompt")
    .eq("id", lessonId)
    .single();
  if (!lesson) return NextResponse.json({ error: "not found" }, { status: 404 });

  const admin = createAdminClient();

  try {
    if (lesson.task_type === "self_check") {
      await admin.from("task_submissions").insert({
        user_id: user.id,
        lesson_id: lesson.id,
        submission_type: "self_check",
        status: "approved",
        reviewed_at: new Date().toISOString(),
      });
      await upsertLessonProgress(admin, user.id, lesson.id, { taskCompleted: true });
      return NextResponse.json({ status: "approved", ai_feedback: null });
    }

    if (lesson.task_type === "text") {
      const text = form.get("text");
      if (typeof text !== "string" || !text.trim()) {
        return NextResponse.json({ error: "Napíš prosím odpoveď." }, { status: 400 });
      }

      const verdict = await gradeTextSubmission(lesson.title, lesson.task_prompt, text.trim());
      await admin.from("task_submissions").insert({
        user_id: user.id,
        lesson_id: lesson.id,
        submission_type: "text",
        content_text: text.trim(),
        status: verdict.approved ? "approved" : "rejected",
        ai_feedback: verdict.feedback,
        reviewed_at: new Date().toISOString(),
      });
      if (verdict.approved) {
        await upsertLessonProgress(admin, user.id, lesson.id, { taskCompleted: true });
      }
      return NextResponse.json({
        status: verdict.approved ? "approved" : "rejected",
        ai_feedback: verdict.feedback,
      });
    }

    // image / pdf
    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Priložte prosím súbor." }, { status: 400 });
    }
    if (file.size > MAX_FILE_BYTES) {
      return NextResponse.json({ error: "Súbor je príliš veľký (max 8 MB)." }, { status: 400 });
    }

    const expectedMime = lesson.task_type === "image" ? "image/" : "application/pdf";
    if (!file.type.startsWith(expectedMime)) {
      return NextResponse.json({ error: "Nesprávny typ súboru." }, { status: 400 });
    }

    const bytes = new Uint8Array(await file.arrayBuffer());
    const base64 = Buffer.from(bytes).toString("base64");

    const verdict = await gradeFileSubmission(
      lesson.title,
      lesson.task_prompt,
      base64,
      file.type,
      lesson.task_type as "image" | "pdf"
    );

    const path = `${user.id}/${lesson.id}/${Date.now()}-${file.name}`;
    const uploaded = await uploadToBucket("task-uploads", path, file, file.type);

    await admin.from("task_submissions").insert({
      user_id: user.id,
      lesson_id: lesson.id,
      submission_type: lesson.task_type,
      file_path: "path" in uploaded ? uploaded.path : null,
      status: verdict.approved ? "approved" : "rejected",
      ai_feedback: verdict.feedback,
      reviewed_at: new Date().toISOString(),
    });
    if (verdict.approved) {
      await upsertLessonProgress(admin, user.id, lesson.id, { taskCompleted: true });
    }

    return NextResponse.json({
      status: verdict.approved ? "approved" : "rejected",
      ai_feedback: verdict.feedback,
    });
  } catch (err) {
    console.error("task submission grading failed", err);
    return NextResponse.json(
      { error: "Vyhodnotenie zlyhalo, skús to prosím o chvíľu znova." },
      { status: 502 }
    );
  }
}
