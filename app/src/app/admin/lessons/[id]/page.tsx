import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
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
  const supabase = await createClient();

  const [{ data: lesson }, { data: sections }, { data: actionSteps }, { data: documents }, { data: audio }] =
    await Promise.all([
      supabase.from("lessons").select("*").eq("id", id).single(),
      supabase.from("sections").select("*").order("order_index", { ascending: true }),
      supabase.from("action_steps").select("*").eq("lesson_id", id).order("order_index"),
      supabase.from("lesson_documents").select("*").eq("lesson_id", id).order("order_index"),
      supabase.from("lesson_audio").select("*").eq("lesson_id", id).order("order_index"),
    ]);

  if (!lesson) notFound();

  return (
    <>
      <Header name={profile.full_name} avatarUrl={profile.avatar_url} isAdmin hasFullAccess />
      <main className="wrap py-16 max-w-3xl">
        <div className="eyebrow mb-6">Administrácia</div>
        <h1 className="font-display text-[clamp(28px,4vw,38px)] font-semibold">
          Deň {lesson.day_number} — {lesson.title}
        </h1>
        <AdminNav active="/admin/lessons" />

        <LessonForm
          lesson={lesson}
          sections={sections ?? []}
          actionSteps={(actionSteps ?? []).map((s) => ({ id: s.id, body: s.body }))}
          documents={documents ?? []}
          audio={audio ?? []}
          nextDayNumber={lesson.day_number}
        />
      </main>
    </>
  );
}
