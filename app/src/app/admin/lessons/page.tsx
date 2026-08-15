import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Header } from "@/components/Header";
import { AdminNav } from "@/components/AdminNav";
import { AdminLessonCard } from "@/components/admin/AdminLessonCard";

export default async function AdminLessonsPage() {
  const profile = await requireAdmin();
  const supabase = await createClient();
  const { data: lessons } = await supabase
    .from("lessons")
    .select("id, day_number, title, is_free, task_type, hls_ready, thumbnail_ready, sections(title)")
    .order("day_number", { ascending: true });

  return (
    <>
      <Header name={profile.full_name} avatarUrl={profile.avatar_url} isAdmin hasFullAccess />
      <main className="wrap py-10">
        <div className="eyebrow mb-4">Administrácia</div>
        <div className="flex items-center justify-between">
          <h1 className="font-display text-[clamp(28px,4vw,38px)] font-semibold">Lekcie</h1>
          <Link href="/admin/lessons/new" className="btn btn-sm">
            + Nová lekcia
          </Link>
        </div>
        <AdminNav active="/admin/lessons" />

        {(lessons ?? []).length === 0 ? (
          <p className="text-muted">Zatiaľ žiadne lekcie — pridaj prvú.</p>
        ) : (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-3">
            {(lessons ?? []).map((l) => {
              const section = Array.isArray(l.sections) ? l.sections[0] : l.sections;
              return (
                <AdminLessonCard
                  key={l.id}
                  lesson={{
                    id: l.id,
                    day_number: l.day_number,
                    title: l.title,
                    is_free: l.is_free,
                    task_type: l.task_type,
                    hls_ready: l.hls_ready,
                    thumbnail_ready: l.thumbnail_ready,
                    sectionTitle: section?.title ?? null,
                  }}
                />
              );
            })}
          </div>
        )}
      </main>
    </>
  );
}
