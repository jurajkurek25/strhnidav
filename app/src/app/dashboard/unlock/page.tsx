import { redirect } from "next/navigation";
import { asc, and, eq } from "drizzle-orm";
import { requireProfile } from "@/lib/auth";
import { db } from "@/lib/db";
import { sections, lessons, sectionPurchases } from "@/lib/db/schema";
import { getCoursePriceEur, getSubscriptionPriceEur } from "@/lib/course-settings";
import { Header } from "@/components/Header";
import { UnlockOptions } from "@/components/UnlockOptions";

export default async function UnlockPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const profile = await requireProfile();
  const { status } = await searchParams;

  if (profile.effectiveFullAccess) redirect("/dashboard");

  const [allSections, allLessons, purchases, coursePriceEur, subscriptionPriceEur] = await Promise.all([
    db.select().from(sections).orderBy(asc(sections.orderIndex)),
    db.select({ sectionId: lessons.sectionId, isFree: lessons.isFree }).from(lessons),
    db
      .select({ sectionId: sectionPurchases.sectionId })
      .from(sectionPurchases)
      .where(and(eq(sectionPurchases.userId, profile.id), eq(sectionPurchases.status, "paid"))),
    getCoursePriceEur(),
    getSubscriptionPriceEur(),
  ]);

  const purchasedSectionIds = new Set(purchases.map((p) => p.sectionId));

  // Only sections that actually gate at least one lesson behind the paywall
  // are worth selling individually — a section that's entirely free (or
  // empty) has nothing to buy.
  const blocks = allSections
    .map((section) => {
      const sectionLessons = allLessons.filter((l) => l.sectionId === section.id);
      return {
        id: section.id,
        title: section.title,
        description: section.description,
        priceEur: section.priceCents / 100,
        lessonCount: sectionLessons.length,
        purchasable: sectionLessons.some((l) => !l.isFree),
        purchased: purchasedSectionIds.has(section.id),
      };
    })
    .filter((b) => b.purchasable);

  return (
    <>
      <Header
        name={profile.fullName}
        avatarUrl={profile.avatarUrl}
        isAdmin={profile.isAdmin}
        hasFullAccess={profile.effectiveFullAccess}
      />
      <main className="wrap py-24">
        <div className="eyebrow mb-6">Vstup do kurzu</div>
        <h1 className="font-display text-[clamp(28px,4vw,40px)] font-semibold max-w-[16ch]">
          Odomkni zvyšok kurzu.
        </h1>

        {status === "cancelled" && (
          <p className="mt-6 text-sm text-[#d98d8d]">
            Platba bola zrušená — skús to znova, keď budeš pripravený.
          </p>
        )}

        <UnlockOptions
          blocks={blocks}
          coursePriceEur={coursePriceEur}
          subscriptionPriceEur={subscriptionPriceEur}
        />
      </main>
    </>
  );
}
