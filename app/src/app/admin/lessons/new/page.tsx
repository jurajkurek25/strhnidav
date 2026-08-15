import { asc, desc } from "drizzle-orm";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { sections, lessons } from "@/lib/db/schema";
import { Header } from "@/components/Header";
import { AdminNav } from "@/components/AdminNav";
import { LessonForm } from "@/components/admin/LessonForm";

export default async function NewLessonPage() {
  const profile = await requireAdmin();

  const [allSections, lastLesson] = await Promise.all([
    db.select().from(sections).orderBy(asc(sections.orderIndex)),
    db.select({ dayNumber: lessons.dayNumber }).from(lessons).orderBy(desc(lessons.dayNumber)).limit(1),
  ]);

  return (
    <>
      <Header name={profile.fullName} avatarUrl={profile.avatarUrl} isAdmin hasFullAccess />
      <main className="wrap py-16 max-w-3xl">
        <div className="eyebrow mb-6">Administrácia</div>
        <h1 className="font-display text-[clamp(28px,4vw,38px)] font-semibold">Nová lekcia</h1>
        <AdminNav active="/admin/lessons" />

        <LessonForm
          lesson={null}
          sections={allSections}
          actionSteps={[]}
          documents={[]}
          audio={[]}
          nextDayNumber={(lastLesson[0]?.dayNumber ?? 0) + 1}
        />
      </main>
    </>
  );
}
