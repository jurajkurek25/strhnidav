import { notFound } from "next/navigation";
import { eq, and } from "drizzle-orm";
import { requireCommunityProfile } from "@/lib/auth";
import { db } from "@/lib/db";
import { profiles, communityBlocks } from "@/lib/db/schema";
import { Header } from "@/components/Header";
import { CommunityNav } from "@/components/CommunityNav";
import { blockUser, unblockUser, reportContent, updateBio } from "@/app/community/actions";

export default async function CommunityProfilePage({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  const profile = await requireCommunityProfile();
  const { userId } = await params;

  const [target] = await db
    .select({
      id: profiles.id,
      fullName: profiles.fullName,
      avatarUrl: profiles.avatarUrl,
      bio: profiles.bio,
      communityGender: profiles.communityGender,
      isAdmin: profiles.isAdmin,
    })
    .from(profiles)
    .where(eq(profiles.id, userId));
  // A regular member without a community profile hasn't joined the
  // community and has no page here. Admins are the one exception — they
  // can post/comment without ever setting a communityGender (see
  // requireCommunityProfile), so their own profile must still render.
  if (!target || (target.communityGender === null && !target.isAdmin)) notFound();

  const isOwnProfile = target.id === profile.id;

  const [iBlockedThem, theyBlockedMe] = isOwnProfile
    ? [false, false]
    : await Promise.all([
        db
          .select({ id: communityBlocks.id })
          .from(communityBlocks)
          .where(and(eq(communityBlocks.blockerId, profile.id), eq(communityBlocks.blockedId, target.id)))
          .then((r) => r.length > 0),
        db
          .select({ id: communityBlocks.id })
          .from(communityBlocks)
          .where(and(eq(communityBlocks.blockerId, target.id), eq(communityBlocks.blockedId, profile.id)))
          .then((r) => r.length > 0),
      ]);

  const canMessage = !isOwnProfile && !iBlockedThem && !theyBlockedMe;

  return (
    <>
      <Header
        name={profile.fullName}
        avatarUrl={profile.avatarUrl}
        isAdmin={profile.isAdmin}
        hasFullAccess={profile.effectiveFullAccess}
      />
      <main className="wrap py-16 max-w-2xl">
        <div className="eyebrow mb-6">Komunita</div>
        <h1 className="font-display text-[clamp(28px,4vw,38px)] font-semibold">Profil</h1>
        <CommunityNav active="" />

        <div className="card flex flex-col items-center gap-5 p-10 text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {target.avatarUrl && (
            <img src={target.avatarUrl} alt="" className="h-20 w-20 rounded-full object-cover" />
          )}
          <h2 className="font-display text-xl font-medium">{target.fullName ?? "Člen"}</h2>
          {target.bio && <p className="max-w-md text-[14.5px] leading-relaxed text-muted">{target.bio}</p>}

          {isOwnProfile ? (
            <form action={updateBio} className="mt-4 flex w-full max-w-sm flex-col gap-3">
              <textarea name="bio" rows={3} defaultValue={target.bio ?? ""} placeholder="Napíš pár viet o sebe…" />
              <button type="submit" className="btn btn-sm self-center">
                Uložiť profil
              </button>
            </form>
          ) : (
            <div className="mt-4 flex flex-wrap items-center justify-center gap-4">
              {canMessage && (
                <a href={`/community/messages/${target.id}`} className="btn btn-sm">
                  Napísať správu
                </a>
              )}
              {iBlockedThem ? (
                <form action={unblockUser.bind(null, target.id)}>
                  <button type="submit" className="btn btn-ghost btn-sm">
                    Odblokovať
                  </button>
                </form>
              ) : (
                !theyBlockedMe && (
                  <form action={blockUser.bind(null, target.id)}>
                    <button type="submit" className="btn btn-ghost btn-sm">
                      Blokovať
                    </button>
                  </form>
                )
              )}
              <form action={reportContent.bind(null, "user", target.id)}>
                <button type="submit" className="text-xs text-muted hover:text-cream">
                  Nahlásiť
                </button>
              </form>
            </div>
          )}
        </div>
      </main>
    </>
  );
}
