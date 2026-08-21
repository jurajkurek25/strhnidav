import { asc, eq, isNull } from "drizzle-orm";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { communityReports, communityPosts, profiles } from "@/lib/db/schema";
import { Header } from "@/components/Header";
import { AdminNav } from "@/components/AdminNav";
import { resolveReport, adminDeletePost } from "@/app/admin/community-actions";

export default async function AdminCommunityReportsPage() {
  const profile = await requireAdmin();

  const openReports = await db
    .select()
    .from(communityReports)
    .where(isNull(communityReports.resolvedAt))
    .orderBy(asc(communityReports.createdAt));

  const enriched = await Promise.all(
    openReports.map(async (report) => {
      const [reporter] = await db
        .select({ fullName: profiles.fullName, email: profiles.email })
        .from(profiles)
        .where(eq(profiles.id, report.reporterId));

      if (report.targetType === "post") {
        const [post] = await db.select().from(communityPosts).where(eq(communityPosts.id, report.targetId));
        const author = post
          ? (await db.select({ fullName: profiles.fullName, email: profiles.email }).from(profiles).where(eq(profiles.id, post.userId)))[0]
          : null;
        return { report, reporter, post, author, targetUser: null };
      }

      const [targetUser] = await db
        .select({ id: profiles.id, fullName: profiles.fullName, email: profiles.email })
        .from(profiles)
        .where(eq(profiles.id, report.targetId));
      return { report, reporter, post: null, author: null, targetUser: targetUser ?? null };
    })
  );

  return (
    <>
      <Header name={profile.fullName} avatarUrl={profile.avatarUrl} isAdmin hasFullAccess />
      <main className="wrap py-16">
        <div className="eyebrow mb-6">Administrácia</div>
        <h1 className="font-display text-[clamp(28px,4vw,38px)] font-semibold">Nahlásenia z komunity</h1>
        <AdminNav active="/admin/community/reports" />

        {enriched.length === 0 && <p className="text-sm text-muted">Žiadne otvorené nahlásenia.</p>}

        <div className="flex flex-col gap-5">
          {enriched.map(({ report, reporter, post, author, targetUser }) => (
            <div key={report.id} className="card flex flex-col gap-4 p-7">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <span className="tag tag-bad">{report.targetType === "post" ? "Príspevok" : "Používateľ"}</span>
                <span className="text-xs text-muted">
                  Nahlásil: {reporter?.fullName ?? reporter?.email ?? "neznámy"} ·{" "}
                  {report.createdAt.toLocaleDateString("sk-SK")}
                </span>
              </div>

              {report.reason && <p className="text-sm text-cream">Dôvod: {report.reason}</p>}

              {report.targetType === "post" && (
                <div className="rounded-sm border border-card-line p-4">
                  {post ? (
                    <>
                      <p className="mb-2 text-xs text-muted">
                        Autor: {author?.fullName ?? author?.email ?? "neznámy"}
                      </p>
                      <p className="whitespace-pre-wrap text-sm text-cream">{post.body}</p>
                    </>
                  ) : (
                    <p className="text-sm text-muted">Príspevok bol už zmazaný.</p>
                  )}
                </div>
              )}

              {report.targetType === "user" && (
                <div className="rounded-sm border border-card-line p-4">
                  <p className="text-sm text-cream">{targetUser?.fullName ?? targetUser?.email ?? "Účet neexistuje."}</p>
                </div>
              )}

              <div className="flex gap-3">
                {report.targetType === "post" && post && (
                  <form action={adminDeletePost.bind(null, post.id, report.id)}>
                    <button type="submit" className="btn btn-danger btn-sm">
                      Zmazať príspevok
                    </button>
                  </form>
                )}
                <form action={resolveReport.bind(null, report.id)}>
                  <button type="submit" className="btn btn-ghost btn-sm">
                    Označiť ako vybavené
                  </button>
                </form>
              </div>
            </div>
          ))}
        </div>
      </main>
    </>
  );
}
