import { desc, isNotNull } from "drizzle-orm";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { profiles } from "@/lib/db/schema";
import { Header } from "@/components/Header";
import { AdminNav } from "@/components/AdminNav";
import { AdminCommunityNav } from "@/components/AdminCommunityNav";
import { toggleCommunityListed } from "@/app/admin/community-actions";

export default async function AdminCommunityMembersPage() {
  const profile = await requireAdmin();

  const members = await db
    .select({
      id: profiles.id,
      fullName: profiles.fullName,
      email: profiles.email,
      avatarUrl: profiles.avatarUrl,
      bio: profiles.bio,
      communityGender: profiles.communityGender,
      communityListed: profiles.communityListed,
      createdAt: profiles.createdAt,
    })
    .from(profiles)
    .where(isNotNull(profiles.communityGender))
    .orderBy(desc(profiles.createdAt));

  return (
    <>
      <Header name={profile.fullName} avatarUrl={profile.avatarUrl} isAdmin hasFullAccess />
      <main className="wrap py-16">
        <div className="eyebrow mb-6">Administrácia</div>
        <h1 className="font-display text-[clamp(28px,4vw,38px)] font-semibold">Členovia komunity</h1>
        <AdminNav active="/admin/community/reports" />
        <AdminCommunityNav active="/admin/community/members" />

        <p className="mb-8 max-w-[64ch] text-sm leading-relaxed text-muted">
          Vypnutím zobrazenia sa daný člen prestane zobrazovať v zozname{" "}
          <code>/community/members</code>, ktorý si navzájom prezerajú ostatní členovia. Naďalej
          môže prispievať do feedu, komentovať aj písať súkromné správy — toto ovplyvňuje len
          jeho viditeľnosť v zozname.
        </p>

        <div className="card overflow-x-auto overflow-y-hidden">
          <table className="w-full min-w-[720px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-card-line text-left text-xs uppercase tracking-wide text-muted">
                <th className="px-6 py-4">Meno</th>
                <th className="px-6 py-4">Email</th>
                <th className="px-6 py-4">Pohlavie</th>
                <th className="px-6 py-4">Bio</th>
                <th className="px-6 py-4">V zozname</th>
                <th className="px-6 py-4" />
              </tr>
            </thead>
            <tbody>
              {members.map((m) => (
                <tr key={m.id} className="border-b border-card-line last:border-0">
                  <td className="px-6 py-4 text-cream">{m.fullName ?? "—"}</td>
                  <td className="px-6 py-4 text-muted">{m.email}</td>
                  <td className="px-6 py-4 text-muted">{m.communityGender === "men" ? "Muž" : "Žena"}</td>
                  <td className="max-w-[240px] truncate px-6 py-4 text-muted">{m.bio ?? "—"}</td>
                  <td className="px-6 py-4">
                    {m.communityListed ? (
                      <span className="tag tag-good">zobrazený</span>
                    ) : (
                      <span className="tag tag-muted">skrytý</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <form action={toggleCommunityListed.bind(null, m.id, m.communityListed)}>
                      <button type="submit" className="btn btn-ghost btn-sm">
                        {m.communityListed ? "Skryť zo zoznamu" : "Zobraziť v zozname"}
                      </button>
                    </form>
                  </td>
                </tr>
              ))}
              {members.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-10 text-center text-muted">
                    Zatiaľ sa nikto nepridal do komunity.
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
