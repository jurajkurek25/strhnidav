import { desc } from "drizzle-orm";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { profiles, freeAccessGrants } from "@/lib/db/schema";
import { Header } from "@/components/Header";
import { AdminNav } from "@/components/AdminNav";
import { setUserAccess, addFreeAccessGrant, removeFreeAccessGrant } from "@/app/admin/actions";

export default async function AdminUsersPage() {
  const profile = await requireAdmin();

  const [users, grants] = await Promise.all([
    db.select().from(profiles).orderBy(desc(profiles.createdAt)),
    db.select().from(freeAccessGrants).orderBy(desc(freeAccessGrants.createdAt)),
  ]);

  const registeredEmails = new Set(users.map((u) => u.email.toLowerCase()));

  return (
    <>
      <Header name={profile.fullName} avatarUrl={profile.avatarUrl} isAdmin hasFullAccess />
      <main className="wrap py-16">
        <div className="eyebrow mb-6">Administrácia</div>
        <h1 className="font-display text-[clamp(28px,4vw,38px)] font-semibold">Členovia</h1>
        <AdminNav active="/admin/users" />

        <section className="mb-16">
          <h2 className="font-display text-lg font-medium mb-3.5">Bezplatný prístup podľa emailu</h2>
          <p className="mb-8 text-sm text-muted max-w-[64ch] leading-relaxed">
            Pridaj Gmail účet a dostane celý kurz zadarmo — hneď, ak sa už niekedy prihlásil,
            alebo automaticky pri prvom prihlásení cez Google.
          </p>

          <div className="grid gap-8 lg:grid-cols-[1fr_320px]">
            <ul className="flex flex-col gap-3.5">
              {grants.map((g) => (
                <li key={g.id} className="card flex items-center justify-between gap-6 p-6">
                  <div className="min-w-0">
                    <p className="truncate text-cream">{g.email}</p>
                    {g.note && <p className="mt-2 text-xs text-muted">{g.note}</p>}
                  </div>
                  <div className="flex shrink-0 items-center gap-4">
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
              {grants.length === 0 && (
                <p className="text-sm text-muted">Zatiaľ žiadne bezplatné účty.</p>
              )}
            </ul>

            <form action={addFreeAccessGrant} className="card flex flex-col gap-4 p-7 h-fit">
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
                <th className="px-6 py-4">Meno</th>
                <th className="px-6 py-4">Email</th>
                <th className="px-6 py-4">Registrácia</th>
                <th className="px-6 py-4">Prístup</th>
                <th className="px-6 py-4" />
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-b border-card-line last:border-0">
                  <td className="px-6 py-4 text-cream">{u.fullName ?? "—"}</td>
                  <td className="px-6 py-4 text-muted">{u.email}</td>
                  <td className="px-6 py-4 text-muted">
                    {u.createdAt.toLocaleDateString("sk-SK")}
                  </td>
                  <td className="px-6 py-4">
                    {u.isAdmin ? (
                      <span className="tag tag-good">admin</span>
                    ) : u.hasFullAccess ? (
                      <span className="tag tag-good">plný kurz</span>
                    ) : (
                      <span className="tag tag-muted">7 lekcií zadarmo</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-right">
                    {!u.isAdmin && (
                      <form action={setUserAccess.bind(null, u.id, !u.hasFullAccess)}>
                        <button type="submit" className="btn btn-ghost btn-sm">
                          {u.hasFullAccess ? "Zrušiť prístup" : "Udeliť plný prístup"}
                        </button>
                      </form>
                    )}
                  </td>
                </tr>
              ))}
              {users.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-10 text-center text-muted">
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
