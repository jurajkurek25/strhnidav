import Link from "next/link";
import { asc, eq } from "drizzle-orm";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { lessons, sections } from "@/lib/db/schema";
import { Header } from "@/components/Header";
import { AdminNav } from "@/components/AdminNav";
import { SortableLessonsGrid } from "@/components/admin/SortableLessonsGrid";

export default async function AdminLessonsPage() {
  const profile = await requireAdmin();
  const rows = await db
    .select({
      id: lessons.id,
      dayNumber: lessons.dayNumber,
      title: lessons.title,
      isFree: lessons.isFree,
      taskType: lessons.taskType,
      hlsReady: lessons.hlsReady,
      thumbnailReady: lessons.thumbnailReady,
      sectionTitle: sections.title,
    })
    .from(lessons)
    .leftJoin(sections, eq(lessons.sectionId, sections.id))
    .orderBy(asc(lessons.dayNumber));

  return (
    <>
      <Header name={profile.fullName} avatarUrl={profile.avatarUrl} isAdmin hasFullAccess />
      <main className="wrap py-16">
        <div className="eyebrow mb-6">Administrácia</div>
        <div className="flex items-center justify-between">
          <h1 className="font-display text-[clamp(28px,4vw,38px)] font-semibold">Lekcie</h1>
          <Link href="/admin/lessons/new" className="btn btn-sm">
            + Nová lekcia
          </Link>
        </div>
        <AdminNav active="/admin/lessons" />
        <p className="mb-8 text-sm text-muted">
          Potiahni kartu za úchytku vpravo hore, aby si zmenil poradie dní.
        </p>

        <SortableLessonsGrid
          initialLessons={rows.map((l) => ({
            id: l.id,
            day_number: l.dayNumber,
            title: l.title,
            is_free: l.isFree,
            task_type: l.taskType,
            hls_ready: l.hlsReady,
            thumbnail_ready: l.thumbnailReady,
            sectionTitle: l.sectionTitle ?? null,
          }))}
        />
      </main>
    </>
  );
}
