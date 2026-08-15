import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Header } from "@/components/Header";
import { AdminNav } from "@/components/AdminNav";
import { deleteLesson } from "@/app/admin/actions";

export default async function AdminLessonsPage() {
  const profile = await requireAdmin();
  const supabase = await createClient();
  const { data: lessons } = await supabase
    .from("lessons")
    .select("id, day_number, title, is_free, task_type, video_path, sections(title)")
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

        <div className="card overflow-hidden">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-card-line text-left text-xs uppercase tracking-wide text-muted">
                <th className="px-4 py-3">Deň</th>
                <th className="px-4 py-3">Názov</th>
                <th className="px-4 py-3">Sekcia</th>
                <th className="px-4 py-3">Úloha</th>
                <th className="px-4 py-3">Video</th>
                <th className="px-4 py-3">Prístup</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {(lessons ?? []).map((l) => {
                const section = Array.isArray(l.sections) ? l.sections[0] : l.sections;
                return (
                  <tr key={l.id} className="border-b border-card-line last:border-0">
                    <td className="px-4 py-3 text-muted">{l.day_number}</td>
                    <td className="px-4 py-3">
                      <Link href={`/admin/lessons/${l.id}`} className="text-cream hover:text-gold-bright">
                        {l.title}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-muted">{section?.title ?? "—"}</td>
                    <td className="px-4 py-3 text-muted">{l.task_type}</td>
                    <td className="px-4 py-3">
                      {l.video_path ? (
                        <span className="tag tag-good">nahrané</span>
                      ) : (
                        <span className="tag tag-muted">chýba</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-muted">{l.is_free ? "zadarmo" : "platené"}</td>
                    <td className="px-4 py-3 text-right">
                      <form action={deleteLesson.bind(null, l.id)}>
                        <button type="submit" className="btn btn-danger btn-sm">
                          Zmazať
                        </button>
                      </form>
                    </td>
                  </tr>
                );
              })}
              {(lessons ?? []).length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-muted">
                    Zatiaľ žiadne lekcie — pridaj prvú.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </main>
    </>
  );
}
