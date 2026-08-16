import Link from "next/link";
import { count, countDistinct, eq } from "drizzle-orm";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { lessons, profiles, payments } from "@/lib/db/schema";
import { COURSE_PRICE_EUR } from "@/lib/stripe";
import { Header } from "@/components/Header";
import { AdminNav } from "@/components/AdminNav";

export default async function AdminHome() {
  const profile = await requireAdmin();

  const [[{ value: lessonCount }], [{ value: memberCount }], [{ value: paidCount }]] = await Promise.all([
    db.select({ value: count() }).from(lessons),
    db.select({ value: count() }).from(profiles),
    // Distinct users with an actual "paid" row in `payments` — i.e. a real
    // Stripe purchase. Deliberately NOT profiles.hasFullAccess, which is
    // also true for members granted free access straight from the admin
    // panel and would otherwise inflate both this count and the earnings
    // figure below with people who never paid anything.
    db.select({ value: countDistinct(payments.userId) }).from(payments).where(eq(payments.status, "paid")),
  ]);

  const earnedEur = paidCount * COURSE_PRICE_EUR;

  const stats = [
    { label: "Lekcie", value: lessonCount },
    { label: "Prihlásení členovia", value: memberCount },
    { label: "Zaplatený plný kurz", value: paidCount },
    { label: "Orientačne zarobené", value: `${earnedEur.toLocaleString("sk-SK")} €` },
  ];

  return (
    <>
      <Header name={profile.fullName} avatarUrl={profile.avatarUrl} isAdmin hasFullAccess />
      <main className="wrap py-16">
        <div className="eyebrow mb-6">Administrácia</div>
        <h1 className="font-display text-[clamp(28px,4vw,38px)] font-semibold">Prehľad kurzu</h1>
        <AdminNav active="/admin" />

        <div className="grid gap-7 sm:grid-cols-2 lg:grid-cols-4">
          {stats.map((s) => (
            <div key={s.label} className="card p-8">
              <div className="font-display text-4xl font-semibold text-gold-bright">{s.value}</div>
              <div className="mt-3.5 text-sm text-muted">{s.label}</div>
            </div>
          ))}
        </div>
        <p className="mt-4 text-[13px] text-muted">
          Orientačne zarobené = počet skutočných platieb cez Stripe × {COURSE_PRICE_EUR} €. Bez
          poplatkov Stripe a bez členov, ktorým si dal prístup zdarma priamo v administrácii.
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
