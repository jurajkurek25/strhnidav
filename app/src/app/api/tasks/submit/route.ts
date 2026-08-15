import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { profiles, lessons, taskSubmissions } from "@/lib/db/schema";
import { getLessonAccess } from "@/lib/course";
import { upsertLessonProgress } from "@/lib/progress";
import { gradeTextSubmission, gradeFileSubmission } from "@/lib/ai-grading";
import { uploadPrivateFile } from "@/lib/media";
import { sanitizeFilename } from "@/lib/storage";

const MAX_FILE_BYTES = 8 * 1024 * 1024;

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const userId = session.user.id;

  const form = await request.formData();
  const lessonId = form.get("lessonId");
  if (typeof lessonId !== "string") {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }

  const [profile] = await db.select({ hasFullAccess: profiles.hasFullAccess }).from(profiles).where(eq(profiles.id, userId));

  const { allowed } = await getLessonAccess(userId, lessonId, profile?.hasFullAccess ?? false);
  if (!allowed) return NextResponse.json({ error: "locked" }, { status: 403 });

  const [lesson] = await db
    .select({ id: lessons.id, title: lessons.title, taskType: lessons.taskType, taskPrompt: lessons.taskPrompt })
    .from(lessons)
    .where(eq(lessons.id, lessonId));
  if (!lesson) return NextResponse.json({ error: "not found" }, { status: 404 });

  try {
    if (lesson.taskType === "self_check") {
      await db.insert(taskSubmissions).values({
        userId,
        lessonId: lesson.id,
        submissionType: "self_check",
        status: "approved",
        reviewedAt: new Date(),
      });
      await upsertLessonProgress(userId, lesson.id, { taskCompleted: true });
      return NextResponse.json({ status: "approved", ai_feedback: null });
    }

    if (lesson.taskType === "text") {
      const text = form.get("text");
      if (typeof text !== "string" || !text.trim()) {
        return NextResponse.json({ error: "Napíš prosím odpoveď." }, { status: 400 });
      }

      const verdict = await gradeTextSubmission(lesson.title, lesson.taskPrompt, text.trim());
      await db.insert(taskSubmissions).values({
        userId,
        lessonId: lesson.id,
        submissionType: "text",
        contentText: text.trim(),
        status: verdict.approved ? "approved" : "rejected",
        aiFeedback: verdict.feedback,
        reviewedAt: new Date(),
      });
      if (verdict.approved) {
        await upsertLessonProgress(userId, lesson.id, { taskCompleted: true });
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

    const expectedMime = lesson.taskType === "image" ? "image/" : "application/pdf";
    if (!file.type.startsWith(expectedMime)) {
      return NextResponse.json({ error: "Nesprávny typ súboru." }, { status: 400 });
    }

    const bytes = new Uint8Array(await file.arrayBuffer());
    const base64 = Buffer.from(bytes).toString("base64");

    const verdict = await gradeFileSubmission(
      lesson.title,
      lesson.taskPrompt,
      base64,
      file.type,
      lesson.taskType as "image" | "pdf"
    );

    const relPath = `${userId}/${lesson.id}/${Date.now()}-${sanitizeFilename(file.name)}`;
    const uploaded = await uploadPrivateFile("task-uploads", relPath, file);

    await db.insert(taskSubmissions).values({
      userId,
      lessonId: lesson.id,
      submissionType: lesson.taskType,
      filePath: "path" in uploaded ? uploaded.path : null,
      status: verdict.approved ? "approved" : "rejected",
      aiFeedback: verdict.feedback,
      reviewedAt: new Date(),
    });
    if (verdict.approved) {
      await upsertLessonProgress(userId, lesson.id, { taskCompleted: true });
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
