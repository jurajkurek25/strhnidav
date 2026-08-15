import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { Header } from "@/components/Header";
import { AdminNav } from "@/components/AdminNav";

export default async function AdminHome() {
  const profile = await requireAdmin();
  const supabase = await createClient();
  // profiles has no "admin sees everyone" RLS policy (by design), so member
  // counts go through the service-role client after requireAdmin() gated this page.
  const admin = createAdminClient();

  const [{ count: lessonCount }, { count: memberCount }, { count: paidCount }] = await Promise.all([
    supabase.from("lessons").select("*", { count: "exact", head: true }),
    admin.from("profiles").select("*", { count: "exact", head: true }),
    admin.from("profiles").select("*", { count: "exact", head: true }).eq("has_full_access", true),
  ]);

  const stats = [
    { label: "Lekcie", value: lessonCount ?? 0 },
    { label: "Prihlásení členovia", value: memberCount ?? 0 },
    { label: "Zaplatený plný kurz", value: paidCount ?? 0 },
  ];

  return (
    <>
      <Header name={profile.full_name} avatarUrl={profile.avatar_url} isAdmin hasFullAccess />
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
