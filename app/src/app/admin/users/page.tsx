import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { Header } from "@/components/Header";
import { AdminNav } from "@/components/AdminNav";
import { setUserAccess, addFreeAccessGrant, removeFreeAccessGrant } from "@/app/admin/actions";

export default async function AdminUsersPage() {
  const profile = await requireAdmin();
  // profiles/free_access_grants have no "admin can see everyone" RLS policy
  // (by design — see supabase/migrations/0001 and 0004), so this page reads
  // through the service-role client after requireAdmin() already gated it.
  const admin = createAdminClient();

  const [{ data: users }, { data: grants }] = await Promise.all([
    admin.from("profiles").select("*").order("created_at", { ascending: false }),
    admin.from("free_access_grants").select("*").order("created_at", { ascending: false }),
  ]);

  const registeredEmails = new Set((users ?? []).map((u) => u.email.toLowerCase()));

  return (
    <>
      <Header name={profile.full_name} avatarUrl={profile.avatar_url} isAdmin hasFullAccess />
      <main className="wrap py-10">
        <div className="eyebrow mb-4">Administrácia</div>
        <h1 className="font-display text-[clamp(28px,4vw,38px)] font-semibold">Členovia</h1>
        <AdminNav active="/admin/users" />

        <section className="mb-12">
          <h2 className="font-display text-lg font-medium mb-1">Bezplatný prístup podľa emailu</h2>
          <p className="mb-5 text-sm text-muted max-w-[64ch]">
            Pridaj Gmail účet a dostane celý kurz zadarmo — hneď, ak sa už niekedy prihlásil,
            alebo automaticky pri prvom prihlásení cez Google.
          </p>

          <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
            <ul className="flex flex-col gap-2.5">
              {(grants ?? []).map((g) => (
                <li key={g.id} className="card flex items-center justify-between gap-4 p-4">
                  <div className="min-w-0">
                    <p className="truncate text-cream">{g.email}</p>
                    {g.note && <p className="mt-1 text-xs text-muted">{g.note}</p>}
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    {registeredEmails.has(g.email.toLowerCase()) ? (
                      <span className="tag tag-good">registrovaný</span>
                    ) : (
                      <span className="tag tag-muted">čaká na prihlásenie</span>
                    )}
                    <form action={removeFreeAccessGrant.bind(null, g.id)}>
                      <button type="submit" className="btn btn-danger btn-sm">
                        Zrušiť
                      </button>
                    </form>
                  </div>
                </li>
              ))}
              {(grants ?? []).length === 0 && (
                <p className="text-sm text-muted">Zatiaľ žiadne bezplatné účty.</p>
              )}
            </ul>

            <form action={addFreeAccessGrant} className="card flex flex-col gap-3 p-5 h-fit">
              <input type="email" name="email" placeholder="meno@gmail.com" required />
              <input type="text" name="note" placeholder="Poznámka (nepovinné)" />
              <button type="submit" className="btn btn-sm self-start">
                Pridať
              </button>
            </form>
          </div>
        </section>

        <div className="card overflow-hidden">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-card-line text-left text-xs uppercase tracking-wide text-muted">
                <th className="px-4 py-3">Meno</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Registrácia</th>
                <th className="px-4 py-3">Prístup</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {(users ?? []).map((u) => (
                <tr key={u.id} className="border-b border-card-line last:border-0">
                  <td className="px-4 py-3 text-cream">{u.full_name ?? "—"}</td>
                  <td className="px-4 py-3 text-muted">{u.email}</td>
                  <td className="px-4 py-3 text-muted">
                    {new Date(u.created_at).toLocaleDateString("sk-SK")}
                  </td>
                  <td className="px-4 py-3">
                    {u.is_admin ? (
                      <span className="tag tag-good">admin</span>
                    ) : u.has_full_access ? (
                      <span className="tag tag-good">plný kurz</span>
                    ) : (
                      <span className="tag tag-muted">7 lekcií zadarmo</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {!u.is_admin && (
                      <form action={setUserAccess.bind(null, u.id, !u.has_full_access)}>
                        <button type="submit" className="btn btn-ghost btn-sm">
                          {u.has_full_access ? "Zrušiť prístup" : "Udeliť plný prístup"}
                        </button>
                      </form>
                    )}
                  </td>
                </tr>
              ))}
              {(users ?? []).length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-muted">
                    Zatiaľ sa nikto neprihlásil.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </main>
    </>
  );
}
