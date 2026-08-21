import { asc, desc, eq } from "drizzle-orm";
import { requireProfile } from "@/lib/auth";
import { db } from "@/lib/db";
import { sections, lessons, giftCards } from "@/lib/db/schema";
import { getCoursePriceEur } from "@/lib/course-settings";
import { Header } from "@/components/Header";
import { GiftShop } from "@/components/GiftShop";
import { redeemGiftCard } from "@/app/dashboard/gift/actions";

export default async function GiftPage({
  searchParams,
}: {
  searchParams: Promise<{
    purchase?: string;
    status?: string;
    redeemSuccess?: string;
    redeemError?: string;
  }>;
}) {
  const profile = await requireProfile();
  const { purchase, status, redeemSuccess, redeemError } = await searchParams;

  const [allSections, allLessons, coursePriceEur, myGiftCards] = await Promise.all([
    db.select().from(sections).orderBy(asc(sections.orderIndex)),
    db.select({ sectionId: lessons.sectionId, isFree: lessons.isFree }).from(lessons),
    getCoursePriceEur(),
    db
      .select()
      .from(giftCards)
      .where(eq(giftCards.purchasedByUserId, profile.id))
      .orderBy(desc(giftCards.createdAt)),
  ]);

  const sectionTitleById = new Map(allSections.map((s) => [s.id, s.title]));

  // Only sections that actually gate at least one lesson behind the
  // paywall are worth gifting individually — same filter as
  // /dashboard/unlock's UnlockOptions.
  const blocks = allSections
    .map((section) => {
      const sectionLessons = allLessons.filter((l) => l.sectionId === section.id);
      return {
        id: section.id,
        title: section.title,
        priceEur: section.priceCents / 100,
        purchasable: sectionLessons.some((l) => !l.isFree),
      };
    })
    .filter((b) => b.purchasable)
    .map(({ id, title, priceEur }) => ({ id, title, priceEur }));

  return (
    <>
      <Header
        name={profile.fullName}
        avatarUrl={profile.avatarUrl}
        isAdmin={profile.isAdmin}
        hasFullAccess={profile.effectiveFullAccess}
      />
      <main className="wrap py-24">
        <div className="eyebrow mb-6">Darčekové karty</div>
        <h1 className="font-display text-[clamp(28px,4vw,40px)] font-semibold max-w-[20ch]">
          Daruj kurz niekomu, na kom ti záleží.
        </h1>
        <p className="mt-6 max-w-[60ch] text-[15px] leading-relaxed text-muted">
          Kúp prístup ako darček — po zaplatení dostaneš kód, ktorý obdarovaný zadá tu na tejto
          stránke a odomkne si ním prístup na svojom vlastnom účte. Darčekové karty sa nedajú
          kúpiť na mesačné predplatné, len na celý kurz alebo jednotlivé bloky.
        </p>

        {purchase === "success" && (
          <p className="mt-6 text-sm text-gold-bright">
            Ďakujeme za nákup! Kód nájdeš nižšie v zozname „Moje zakúpené darčekové karty“.
          </p>
        )}
        {status === "cancelled" && (
          <p className="mt-6 text-sm text-[#d98d8d]">Platba bola zrušená — skús to znova, keď budeš pripravený.</p>
        )}

        <div className="mt-12">
          <GiftShop blocks={blocks} coursePriceEur={coursePriceEur} />
        </div>

        <div className="card mt-16 p-8">
          <h2 className="font-display text-lg font-medium mb-5">Aktivovať darčekovú kartu</h2>
          {redeemSuccess && (
            <p className="mb-4 text-sm text-gold-bright">
              Darčeková karta bola úspešne aktivovaná — prístup máš už teraz.
            </p>
          )}
          {redeemError && <p className="mb-4 text-sm text-[#d98d8d]">{decodeURIComponent(redeemError)}</p>}
          <form action={redeemGiftCard} className="flex flex-wrap gap-3">
            <input
              type="text"
              name="code"
              placeholder="SD-XXXX-XXXX-XXXX"
              required
              className="min-w-[220px] flex-1"
            />
            <button type="submit" className="btn btn-sm">
              Aktivovať
            </button>
          </form>
        </div>

        {myGiftCards.length > 0 && (
          <div className="mt-16">
            <h2 className="font-display text-lg font-medium mb-5">Moje zakúpené darčekové karty</h2>
            <div className="flex flex-col gap-3">
              {myGiftCards.map((card) => (
                <div key={card.id} className="card flex flex-wrap items-center justify-between gap-4 p-5">
                  <div>
                    <code className="text-gold-bright">{card.code}</code>
                    <p className="mt-1 text-xs text-muted">
                      {card.kind === "course" ? "Celý kurz" : sectionTitleById.get(card.sectionId ?? "") ?? "Blok"}
                    </p>
                  </div>
                  <span className={`tag ${card.redeemedAt ? "tag-good" : "tag-muted"}`}>
                    {card.status !== "paid"
                      ? "Čaká na platbu"
                      : card.redeemedAt
                      ? "Aktivovaná"
                      : "Pripravená na aktiváciu"}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </>
  );
}
