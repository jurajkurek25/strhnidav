import { notFound } from "next/navigation";
import { asc, eq } from "drizzle-orm";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { lessons, sections, actionSteps, lessonDocuments, lessonAudio } from "@/lib/db/schema";
import { Header } from "@/components/Header";
import { AdminNav } from "@/components/AdminNav";
import { LessonForm } from "@/components/admin/LessonForm";

export default async function EditLessonPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const profile = await requireAdmin();

  const [lesson, allSections, steps, documents, audio] = await Promise.all([
    db.query.lessons.findFirst({ where: eq(lessons.id, id) }),
    db.select().from(sections).orderBy(asc(sections.orderIndex)),
    db.select().from(actionSteps).where(eq(actionSteps.lessonId, id)).orderBy(asc(actionSteps.orderIndex)),
    db.select().from(lessonDocuments).where(eq(lessonDocuments.lessonId, id)).orderBy(asc(lessonDocuments.orderIndex)),
    db.select().from(lessonAudio).where(eq(lessonAudio.lessonId, id)).orderBy(asc(lessonAudio.orderIndex)),
  ]);

  if (!lesson) notFound();

  return (
    <>
      <Header name={profile.fullName} avatarUrl={profile.avatarUrl} isAdmin hasFullAccess />
      <main className="wrap py-16 max-w-3xl">
        <div className="eyebrow mb-6">Administrácia</div>
        <h1 className="font-display text-[clamp(28px,4vw,38px)] font-semibold">
          Deň {lesson.dayNumber} — {lesson.title}
        </h1>
        <AdminNav active="/admin/lessons" />

        <LessonForm
          lesson={lesson}
          sections={allSections}
          actionSteps={steps.map((s) => ({ id: s.id, body: s.body }))}
          documents={documents}
          audio={audio}
          nextDayNumber={lesson.dayNumber}
        />
      </main>
    </>
  );
}
