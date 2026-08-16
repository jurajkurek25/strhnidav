import { asc } from "drizzle-orm";
import { requireProfile } from "@/lib/auth";
import { db } from "@/lib/db";
import { sections } from "@/lib/db/schema";
import { getLessonStatesForUser } from "@/lib/course";
import { Header } from "@/components/Header";
import { LessonGridCard } from "@/components/LessonGridCard";

export default async function DashboardPage() {
  const profile = await requireProfile();

  const [allSections, states] = await Promise.all([
    db.select().from(sections).orderBy(asc(sections.orderIndex)),
    getLessonStatesForUser(profile.id, profile.hasFullAccess),
  ]);

  const sectionById = new Map(allSections.map((s) => [s.id, s]));
  const groups = new Map<string, { title: string; order: number; entries: typeof states }>();

  for (const entry of states) {
    const section = entry.lesson.sectionId ? sectionById.get(entry.lesson.sectionId) : null;
    const key = section?.id ?? "__unassigned";
    if (!groups.has(key)) {
      groups.set(key, {
        title: section?.title ?? "Ďalšie lekcie",
        order: section?.orderIndex ?? 9999,
        entries: [],
      });
    }
    groups.get(key)!.entries.push(entry);
  }

  const orderedGroups = [...groups.values()].sort((a, b) => a.order - b.order);
  const completedCount = states.filter((s) => s.state === "completed").length;
  const courseCompleted = profile.hasFullAccess && states.length > 0 && completedCount === states.length;

  return (
    <>
      <Header
        name={profile.fullName}
        avatarUrl={profile.avatarUrl}
        isAdmin={profile.isAdmin}
        hasFullAccess={profile.hasFullAccess}
      />
      <main className="wrap py-20">
        <div className="eyebrow mb-6">Členská sekcia</div>
        <h1 className="font-display text-[clamp(30px,4vw,44px)] font-semibold leading-tight">
          Vitaj späť{profile.fullName ? `, ${profile.fullName.split(" ")[0]}` : ""}.
        </h1>
        <p className="mt-6 text-[15px] leading-relaxed text-muted">
          Splnené <b className="text-gold-bright">{completedCount}</b> / {states.length} lekcií.
          {!profile.hasFullAccess && (
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

        {courseCompleted && (
          <div className="card mt-10 flex flex-wrap items-center justify-between gap-6 p-8">
            <div>
              <div className="eyebrow mb-3">Kurz dokončený</div>
              <p className="font-display text-[19px] font-medium">
                Absolvoval/-a si celý program — vyzdvihni si svoj certifikát.
              </p>
            </div>
            <a href="/dashboard/certificate" className="btn shrink-0">
              Vygenerovať certifikát
            </a>
          </div>
        )}

        {states.length === 0 && (
          <p className="mt-12 text-muted">
            Kurz sa ešte pripravuje — lekcie tu pribudnú čoskoro.
          </p>
        )}

        {orderedGroups.map((group) => (
          <section key={group.title} className="mt-24">
            <h2 className="font-display text-[22px] font-medium mb-9">{group.title}</h2>
            <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 xl:grid-cols-3">
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
