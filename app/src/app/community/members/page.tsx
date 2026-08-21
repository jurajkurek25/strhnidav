import { and, eq, isNotNull } from "drizzle-orm";
import { requireCommunityProfile } from "@/lib/auth";
import { db } from "@/lib/db";
import { profiles, communityBlocks } from "@/lib/db/schema";
import { Header } from "@/components/Header";
import { CommunityNav } from "@/components/CommunityNav";

export default async function CommunityMembersPage() {
  const profile = await requireCommunityProfile();

  const [blocksIMade, blocksOnMe, rawMembers] = await Promise.all([
    db.select({ id: communityBlocks.blockedId }).from(communityBlocks).where(eq(communityBlocks.blockerId, profile.id)),
    db.select({ id: communityBlocks.blockerId }).from(communityBlocks).where(eq(communityBlocks.blockedId, profile.id)),
    db
      .select({
        id: profiles.id,
        fullName: profiles.fullName,
        avatarUrl: profiles.avatarUrl,
        bio: profiles.bio,
      })
      .from(profiles)
      .where(
        and(
          isNotNull(profiles.communityGender),
          eq(profiles.communityListed, true)
        )
      ),
  ]);

  const excluded = new Set([...blocksIMade.map((b) => b.id), ...blocksOnMe.map((b) => b.id), profile.id]);
  const members = rawMembers.filter((m) => !excluded.has(m.id));

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
        <h1 className="font-display text-[clamp(28px,4vw,38px)] font-semibold">Členovia</h1>
        <CommunityNav active="/community/members" />

        {members.length === 0 && <p className="text-sm text-muted">Zatiaľ tu nie sú žiadni ďalší členovia.</p>}

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          {members.map((m) => (
            <a key={m.id} href={`/community/profile/${m.id}`} className="card flex items-center gap-4 p-6 hover:border-gold">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {m.avatarUrl && <img src={m.avatarUrl} alt="" className="h-12 w-12 shrink-0 rounded-full object-cover" />}
              <div className="min-w-0">
                <p className="font-display text-[15px] font-medium text-cream">{m.fullName ?? "Člen"}</p>
                {m.bio && <p className="mt-1 truncate text-[13px] text-muted">{m.bio}</p>}
              </div>
            </a>
          ))}
        </div>
      </main>
    </>
  );
}
