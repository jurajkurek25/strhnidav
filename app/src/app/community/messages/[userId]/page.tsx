import { notFound } from "next/navigation";
import { asc, eq } from "drizzle-orm";
import { requireCommunityProfile } from "@/lib/auth";
import { db } from "@/lib/db";
import { profiles, communityMessages } from "@/lib/db/schema";
import { communityAreBlocked, findConversation, markMessagesRead } from "@/lib/community";
import { Header } from "@/components/Header";
import { CommunityNav } from "@/components/CommunityNav";
import { sendMessage } from "@/app/community/actions";

export default async function CommunityThreadPage({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  const profile = await requireCommunityProfile();
  const { userId } = await params;
  if (userId === profile.id) notFound();

  const [other] = await db
    .select({ id: profiles.id, fullName: profiles.fullName, avatarUrl: profiles.avatarUrl, communityGender: profiles.communityGender })
    .from(profiles)
    .where(eq(profiles.id, userId));
  if (!other || other.communityGender === null) notFound();

  const blocked = await communityAreBlocked(profile.id, other.id);

  const conversation = await findConversation(profile.id, other.id);
  const messages = conversation
    ? await db
        .select()
        .from(communityMessages)
        .where(eq(communityMessages.conversationId, conversation.id))
        .orderBy(asc(communityMessages.createdAt))
    : [];

  if (conversation) await markMessagesRead(conversation.id, profile.id);

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
        <h1 className="font-display text-[clamp(24px,4vw,32px)] font-semibold">
          <a href={`/community/profile/${other.id}`} className="hover:text-gold-bright">
            {other.fullName ?? "Člen"}
          </a>
        </h1>
        <CommunityNav active="/community/messages" />

        <div className="flex flex-col gap-4">
          {messages.length === 0 && <p className="text-sm text-muted">Zatiaľ žiadne správy.</p>}
          {messages.map((m) => {
            const isMine = m.senderId === profile.id;
            return (
              <div key={m.id} className={`flex ${isMine ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[75%] rounded-md px-4 py-3 text-[14px] leading-relaxed ${
                    isMine ? "bg-gold text-bg" : "card text-cream"
                  }`}
                >
                  {m.body}
                </div>
              </div>
            );
          })}
        </div>

        {blocked ? (
          <p className="mt-8 text-sm text-muted">Tomuto používateľovi nemôžeš napísať správu.</p>
        ) : (
          <form action={sendMessage.bind(null, other.id)} className="mt-8 flex gap-3">
            <input type="text" name="body" placeholder="Napíš správu…" required className="flex-1" />
            <button type="submit" className="btn btn-sm shrink-0">
              Odoslať
            </button>
          </form>
        )}
      </main>
    </>
  );
}
