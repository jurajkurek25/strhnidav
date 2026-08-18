import { asc, count, eq } from "drizzle-orm";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { sections, lessons, courseSettings } from "@/lib/db/schema";
import { Header } from "@/components/Header";
import { AdminNav } from "@/components/AdminNav";
import { SortableSections } from "@/components/admin/SortableSections";
import { createSection, updateCourseSettings } from "@/app/admin/actions";

export default async function AdminSectionsPage() {
  const profile = await requireAdmin();
  const [rows, [course]] = await Promise.all([
    db
      .select({
        id: sections.id,
        title: sections.title,
        description: sections.description,
        priceCents: sections.priceCents,
        slug: sections.slug,
        lessonCount: count(lessons.id),
      })
      .from(sections)
      .leftJoin(lessons, eq(lessons.sectionId, sections.id))
      .groupBy(sections.id)
      .orderBy(asc(sections.orderIndex)),
    db
      .select({ priceCents: courseSettings.priceCents, subscriptionPriceCents: courseSettings.subscriptionPriceCents })
      .from(courseSettings)
      .where(eq(courseSettings.id, true)),
  ]);

  return (
    <>
      <Header name={profile.fullName} avatarUrl={profile.avatarUrl} isAdmin hasFullAccess />
      <main className="wrap py-16">
        <div className="eyebrow mb-6">Administrácia</div>
        <h1 className="font-display text-[clamp(28px,4vw,38px)] font-semibold">Sekcie kurzu</h1>
        <AdminNav active="/admin/sections" />

        <form action={updateCourseSettings} className="card mb-10 flex flex-wrap items-end gap-3 p-6">
          <label className="flex flex-col gap-1.5 text-xs text-muted">
            Cena celého kurzu (€)
            <input
              type="number"
              name="price_eur"
              step="0.01"
              min="0"
              defaultValue={((course?.priceCents ?? 29900) / 100).toFixed(2)}
              className="!w-32 !py-2.5 !px-3 !text-sm"
            />
          </label>
          <label className="flex flex-col gap-1.5 text-xs text-muted">
            Cena predplatného (€ / mesiac)
            <input
              type="number"
              name="subscription_price_eur"
              step="0.01"
              min="0"
              defaultValue={((course?.subscriptionPriceCents ?? 2990) / 100).toFixed(2)}
              className="!w-32 !py-2.5 !px-3 !text-sm"
            />
          </label>
          <button type="submit" className="btn btn-ghost btn-sm">
            Uložiť ceny
          </button>
        </form>

        <div className="grid gap-10 lg:grid-cols-[1fr_320px]">
          <SortableSections
            initialSections={rows.map((s) => ({
              id: s.id,
              title: s.title,
              description: s.description,
              priceCents: s.priceCents,
              slug: s.slug,
              lessonCount: s.lessonCount,
            }))}
          />

          <form action={createSection} className="card flex flex-col gap-4 p-7 h-fit">
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
