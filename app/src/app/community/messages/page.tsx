import { and, count, desc, eq, isNull, ne, or } from "drizzle-orm";
import { requireCommunityProfile } from "@/lib/auth";
import { db } from "@/lib/db";
import { communityConversations, communityMessages, profiles } from "@/lib/db/schema";
import { Header } from "@/components/Header";
import { CommunityNav } from "@/components/CommunityNav";

export default async function CommunityMessagesPage() {
  const profile = await requireCommunityProfile();

  const conversations = await db
    .select()
    .from(communityConversations)
    .where(or(eq(communityConversations.userAId, profile.id), eq(communityConversations.userBId, profile.id)));

  const enriched = await Promise.all(
    conversations.map(async (c) => {
      const otherId = c.userAId === profile.id ? c.userBId : c.userAId;
      const [[otherProfile], [lastMessage], [{ value: unreadCount }]] = await Promise.all([
        db
          .select({ id: profiles.id, fullName: profiles.fullName, avatarUrl: profiles.avatarUrl })
          .from(profiles)
          .where(eq(profiles.id, otherId)),
        db
          .select()
          .from(communityMessages)
          .where(eq(communityMessages.conversationId, c.id))
          .orderBy(desc(communityMessages.createdAt))
          .limit(1),
        db
          .select({ value: count() })
          .from(communityMessages)
          .where(
            and(
              eq(communityMessages.conversationId, c.id),
              ne(communityMessages.senderId, profile.id),
              isNull(communityMessages.readAt)
            )
          ),
      ]);
      return { conversationId: c.id, otherProfile, lastMessage, unreadCount };
    })
  );

  const withMessages = enriched
    .filter((c) => c.otherProfile && c.lastMessage)
    .sort((a, b) => (b.lastMessage!.createdAt.getTime() - a.lastMessage!.createdAt.getTime()));

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
        <h1 className="font-display text-[clamp(28px,4vw,38px)] font-semibold">Správy</h1>
        <CommunityNav active="/community/messages" />

        {withMessages.length === 0 && (
          <p className="text-sm text-muted">Zatiaľ nemáš žiadne konverzácie.</p>
        )}

        <div className="flex flex-col gap-3">
          {withMessages.map((c) => (
            <a
              key={c.conversationId}
              href={`/community/messages/${c.otherProfile!.id}`}
              className="card flex items-center gap-4 p-5 hover:border-gold"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {c.otherProfile!.avatarUrl && (
                <img src={c.otherProfile!.avatarUrl} alt="" className="h-11 w-11 rounded-full object-cover" />
              )}
              <div className="min-w-0 flex-1">
                <p className="font-display text-[15px] font-medium text-cream">
                  {c.otherProfile!.fullName ?? "Člen"}
                </p>
                <p className="mt-1 truncate text-[13px] text-muted">{c.lastMessage!.body}</p>
              </div>
              {c.unreadCount > 0 && <span className="tag tag-good shrink-0">{c.unreadCount}</span>}
            </a>
          ))}
        </div>
      </main>
    </>
  );
}
