import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Header } from "@/components/Header";
import { AdminNav } from "@/components/AdminNav";
import { LessonForm } from "@/components/admin/LessonForm";

export default async function NewLessonPage() {
  const profile = await requireAdmin();
  const supabase = await createClient();

  const [{ data: sections }, { data: lastLesson }] = await Promise.all([
    supabase.from("sections").select("*").order("order_index", { ascending: true }),
    supabase
      .from("lessons")
      .select("day_number")
      .order("day_number", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  return (
    <>
      <Header name={profile.full_name} avatarUrl={profile.avatar_url} isAdmin hasFullAccess />
      <main className="wrap py-10 max-w-3xl">
        <div className="eyebrow mb-4">Administrácia</div>
        <h1 className="font-display text-[clamp(28px,4vw,38px)] font-semibold">Nová lekcia</h1>
        <AdminNav active="/admin/lessons" />

        <LessonForm
          lesson={null}
          sections={sections ?? []}
          actionSteps={[]}
          documents={[]}
          audio={[]}
          nextDayNumber={(lastLesson?.day_number ?? 0) + 1}
        />
      </main>
    </>
  );
}
