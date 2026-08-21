import { desc, eq } from "drizzle-orm";
import { requireCommunityProfile } from "@/lib/auth";
import { db } from "@/lib/db";
import { communityPosts, communityBlocks, profiles } from "@/lib/db/schema";
import { Header } from "@/components/Header";
import { CommunityNav } from "@/components/CommunityNav";
import { createPost, deletePost, reportContent } from "@/app/community/actions";

function timeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return "práve teraz";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `pred ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `pred ${hours} h`;
  const days = Math.floor(hours / 24);
  return `pred ${days} d`;
}

export default async function CommunityFeedPage() {
  const profile = await requireCommunityProfile();

  const [blocksIMade, blocksOnMe, rawPosts] = await Promise.all([
    db.select({ id: communityBlocks.blockedId }).from(communityBlocks).where(eq(communityBlocks.blockerId, profile.id)),
    db.select({ id: communityBlocks.blockerId }).from(communityBlocks).where(eq(communityBlocks.blockedId, profile.id)),
    db
      .select({
        id: communityPosts.id,
        body: communityPosts.body,
        createdAt: communityPosts.createdAt,
        authorId: profiles.id,
        authorName: profiles.fullName,
        authorAvatar: profiles.avatarUrl,
      })
      .from(communityPosts)
      .innerJoin(profiles, eq(profiles.id, communityPosts.userId))
      .orderBy(desc(communityPosts.createdAt))
      .limit(60),
  ]);

  const excluded = new Set([...blocksIMade.map((b) => b.id), ...blocksOnMe.map((b) => b.id)]);
  const posts = rawPosts.filter((p) => !excluded.has(p.authorId));

  return (
    <>
      <Header
        name={profile.fullName}
        avatarUrl={profile.avatarUrl}
        isAdmin={profile.isAdmin}
        hasFullAccess={profile.effectiveFullAccess}
      />
      <main className="wrap py-16 max-w-3xl">
        <div className="eyebrow mb-6">Komunita</div>
        <h1 className="font-display text-[clamp(28px,4vw,38px)] font-semibold">Feed</h1>
        <CommunityNav active="/community" />

        <form action={createPost} className="card mt-10 flex flex-col gap-4 p-7">
          <textarea name="body" rows={3} placeholder="Podeľ sa s komunitou o niečo…" required />
          <button type="submit" className="btn btn-sm self-start">
            Uverejniť
          </button>
        </form>

        <div className="mt-10 flex flex-col gap-5">
          {posts.length === 0 && <p className="text-sm text-muted">Zatiaľ tu nie sú žiadne príspevky.</p>}
          {posts.map((post) => (
            <article key={post.id} className="card p-7">
              <div className="flex items-center justify-between gap-4">
                <a href={`/community/profile/${post.authorId}`} className="flex items-center gap-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {post.authorAvatar && (
                    <img src={post.authorAvatar} alt="" className="h-9 w-9 rounded-full object-cover" />
                  )}
                  <span className="font-display text-[15px] font-medium text-cream">
                    {post.authorName ?? "Člen"}
                  </span>
                </a>
                <span className="text-xs text-muted">{timeAgo(post.createdAt)}</span>
              </div>
              <p className="mt-4 whitespace-pre-wrap text-[14.5px] leading-relaxed text-cream">{post.body}</p>
              <div className="mt-5 flex gap-4 text-xs text-muted">
                {post.authorId === profile.id ? (
                  <form action={deletePost.bind(null, post.id)}>
                    <button type="submit" className="hover:text-[#d98d8d]">
                      Zmazať
                    </button>
                  </form>
                ) : (
                  <form action={reportContent.bind(null, "post", post.id)}>
                    <button type="submit" className="hover:text-cream">
                      Nahlásiť
                    </button>
                  </form>
                )}
              </div>
            </article>
          ))}
        </div>
      </main>
    </>
  );
}
