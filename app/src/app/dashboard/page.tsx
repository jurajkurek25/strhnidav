import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getLessonStatesForUser } from "@/lib/course";
import { Header } from "@/components/Header";
import { LessonGridCard } from "@/components/LessonGridCard";

export default async function DashboardPage() {
  const profile = await requireProfile();
  const supabase = await createClient();

  const [{ data: sections }, states] = await Promise.all([
    supabase.from("sections").select("*").order("order_index", { ascending: true }),
    getLessonStatesForUser(supabase, profile.id, profile.has_full_access),
  ]);

  const sectionById = new Map((sections ?? []).map((s) => [s.id, s]));
  const groups = new Map<string, { title: string; order: number; entries: typeof states }>();

  for (const entry of states) {
    const section = entry.lesson.section_id ? sectionById.get(entry.lesson.section_id) : null;
    const key = section?.id ?? "__unassigned";
    if (!groups.has(key)) {
      groups.set(key, {
        title: section?.title ?? "Ďalšie lekcie",
        order: section?.order_index ?? 9999,
        entries: [],
      });
    }
    groups.get(key)!.entries.push(entry);
  }

  const orderedGroups = [...groups.values()].sort((a, b) => a.order - b.order);
  const completedCount = states.filter((s) => s.state === "completed").length;

  return (
    <>
      <Header
        name={profile.full_name}
        avatarUrl={profile.avatar_url}
        isAdmin={profile.is_admin}
        hasFullAccess={profile.has_full_access}
      />
      <main className="wrap py-14">
        <div className="eyebrow mb-4">Členská sekcia</div>
        <h1 className="font-display text-[clamp(30px,4vw,44px)] font-semibold leading-tight">
          Vitaj späť{profile.full_name ? `, ${profile.full_name.split(" ")[0]}` : ""}.
        </h1>
        <p className="mt-4 text-[15px] leading-relaxed text-muted">
          Splnené <b className="text-gold-bright">{completedCount}</b> / {states.length} lekcií.
          {!profile.has_full_access && (
            <>
              {" "}
              Prvých 7 lekcií máš zadarmo — potom odomkneš{" "}
              <a href="/dashboard/unlock" className="text-gold-bright underline">
                celý kurz za 199 €
              </a>
              .
            </>
          )}
        </p>

        {states.length === 0 && (
          <p className="mt-10 text-muted">
            Kurz sa ešte pripravuje — lekcie tu pribudnú čoskoro.
          </p>
        )}

        {orderedGroups.map((group) => (
          <section key={group.title} className="mt-16">
            <h2 className="font-display text-[22px] font-medium mb-7">{group.title}</h2>
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-3">
              {group.entries.map((entry) => (
                <LessonGridCard key={entry.lesson.id} entry={entry} />
              ))}
            </div>
          </section>
        ))}
      </main>
    </>
  );
}
