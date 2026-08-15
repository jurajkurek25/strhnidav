import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Header } from "@/components/Header";
import { AdminNav } from "@/components/AdminNav";
import { SortableSections } from "@/components/admin/SortableSections";
import { createSection } from "@/app/admin/actions";

export default async function AdminSectionsPage() {
  const profile = await requireAdmin();
  const supabase = await createClient();
  const { data: sections } = await supabase
    .from("sections")
    .select("*, lessons(count)")
    .order("order_index", { ascending: true });

  return (
    <>
      <Header name={profile.full_name} avatarUrl={profile.avatar_url} isAdmin hasFullAccess />
      <main className="wrap py-10">
        <div className="eyebrow mb-4">Administrácia</div>
        <h1 className="font-display text-[clamp(28px,4vw,38px)] font-semibold">Sekcie kurzu</h1>
        <AdminNav active="/admin/sections" />

        <div className="grid gap-8 lg:grid-cols-[1fr_320px]">
          <SortableSections
            initialSections={(sections ?? []).map((s) => ({
              id: s.id,
              title: s.title,
              description: s.description,
              lessonCount: Array.isArray(s.lessons) ? (s.lessons[0]?.count ?? 0) : 0,
            }))}
          />

          <form action={createSection} className="card flex flex-col gap-3 p-5 h-fit">
            <h2 className="font-display text-base font-medium">Nová sekcia</h2>
            <input type="text" name="title" placeholder="Názov (napr. Randenie)" required />
            <textarea name="description" placeholder="Krátky popis (nepovinné)" rows={2} />
            <button type="submit" className="btn btn-sm self-start">
              Pridať sekciu
            </button>
          </form>
        </div>
      </main>
    </>
  );
}
