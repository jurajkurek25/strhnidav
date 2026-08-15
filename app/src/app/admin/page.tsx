import Link from "next/link";
import { count, eq } from "drizzle-orm";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { lessons, profiles } from "@/lib/db/schema";
import { Header } from "@/components/Header";
import { AdminNav } from "@/components/AdminNav";

export default async function AdminHome() {
  const profile = await requireAdmin();

  const [[{ value: lessonCount }], [{ value: memberCount }], [{ value: paidCount }]] = await Promise.all([
    db.select({ value: count() }).from(lessons),
    db.select({ value: count() }).from(profiles),
    db.select({ value: count() }).from(profiles).where(eq(profiles.hasFullAccess, true)),
  ]);

  const stats = [
    { label: "Lekcie", value: lessonCount },
    { label: "Prihlásení členovia", value: memberCount },
    { label: "Zaplatený plný kurz", value: paidCount },
  ];

  return (
    <>
      <Header name={profile.fullName} avatarUrl={profile.avatarUrl} isAdmin hasFullAccess />
      <main className="wrap py-16">
        <div className="eyebrow mb-6">Administrácia</div>
        <h1 className="font-display text-[clamp(28px,4vw,38px)] font-semibold">Prehľad kurzu</h1>
        <AdminNav active="/admin" />

        <div className="grid gap-7 sm:grid-cols-3">
          {stats.map((s) => (
            <div key={s.label} className="card p-8">
              <div className="font-display text-4xl font-semibold text-gold-bright">{s.value}</div>
              <div className="mt-3.5 text-sm text-muted">{s.label}</div>
            </div>
          ))}
        </div>

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
