import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Header } from "@/components/Header";
import { AdminNav } from "@/components/AdminNav";
import { setUserAccess } from "@/app/admin/actions";

export default async function AdminUsersPage() {
  const profile = await requireAdmin();
  const supabase = await createClient();

  const { data: users } = await supabase
    .from("profiles")
    .select("*")
    .order("created_at", { ascending: false });

  return (
    <>
      <Header name={profile.full_name} avatarUrl={profile.avatar_url} isAdmin hasFullAccess />
      <main className="wrap py-10">
        <div className="eyebrow mb-4">Administrácia</div>
        <h1 className="font-display text-[clamp(28px,4vw,38px)] font-semibold">Členovia</h1>
        <AdminNav active="/admin/users" />

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
