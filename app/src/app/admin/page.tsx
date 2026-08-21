import Link from "next/link";
import { count, countDistinct, eq, sql } from "drizzle-orm";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { lessons, profiles, payments, sectionPurchases } from "@/lib/db/schema";
import { Header } from "@/components/Header";
import { AdminNav } from "@/components/AdminNav";

export default async function AdminHome() {
  const profile = await requireAdmin();

  const [
    [{ value: lessonCount }],
    [{ value: memberCount }],
    [{ value: paidCount }],
    [{ value: blockPaidCount }],
    [{ value: courseCents }],
    [{ value: blockCents }],
  ] = await Promise.all([
    db.select({ value: count() }).from(lessons),
    db.select({ value: count() }).from(profiles),
    // Distinct users with an actual "paid" row in `payments` — i.e. a real
    // Stripe purchase. Deliberately NOT profiles.hasFullAccess, which is
    // also true for members granted free access straight from the admin
    // panel and would otherwise inflate both this count and the earnings
    // figure below with people who never paid anything.
    db.select({ value: countDistinct(payments.userId) }).from(payments).where(eq(payments.status, "paid")),
    db.select({ value: count() }).from(sectionPurchases).where(eq(sectionPurchases.status, "paid")),
    // Summed from each row's own recorded amount, not count × today's
    // price — the course/block price has changed over time, so a purchase
    // made before a price change must still count at what was actually
    // paid.
    db
      .select({ value: sql<number>`coalesce(sum(${payments.amountCents}), 0)` })
      .from(payments)
      .where(eq(payments.status, "paid")),
    db
      .select({ value: sql<number>`coalesce(sum(${sectionPurchases.amountCents}), 0)` })
      .from(sectionPurchases)
      .where(eq(sectionPurchases.status, "paid")),
  ]);

  const earnedEur = (Number(courseCents) + Number(blockCents)) / 100;

  const stats = [
    { label: "Lekcie", value: lessonCount },
    { label: "Prihlásení členovia", value: memberCount },
    { label: "Zaplatený plný kurz", value: paidCount },
    { label: "Predané bloky", value: blockPaidCount },
    { label: "Orientačne zarobené", value: `${earnedEur.toLocaleString("sk-SK")} €` },
  ];

  return (
    <>
      <Header name={profile.fullName} avatarUrl={profile.avatarUrl} isAdmin hasFullAccess />
      <main className="wrap py-16">
        <div className="eyebrow mb-6">Administrácia</div>
        <h1 className="font-display text-[clamp(28px,4vw,38px)] font-semibold">Prehľad kurzu</h1>
        <AdminNav active="/admin" />

        <div className="grid gap-7 sm:grid-cols-2 lg:grid-cols-5">
          {stats.map((s) => (
            <div key={s.label} className="card p-8">
              <div className="font-display text-4xl font-semibold text-gold-bright">{s.value}</div>
              <div className="mt-3.5 text-sm text-muted">{s.label}</div>
            </div>
          ))}
        </div>
        <p className="mt-4 text-[13px] text-muted">
          Orientačne zarobené = súčet skutočne zaplatených súm za celý kurz aj za jednotlivé
          bloky, každá v cene, za akú bola v tom čase zaplatená. Bez poplatkov Stripe, bez
          predplatného a bez členov, ktorým si dal prístup zdarma priamo v administrácii.
        </p>

        <div className="mt-16 flex gap-4">
          <Link href="/admin/lessons/new" className="btn">
            + Nová lekcia
          </Link>
          <Link href="/admin/sections" className="btn btn-ghost">
            Spravovať sekcie
          </Link>
        </div>
      </main>
    </>
  );
}
