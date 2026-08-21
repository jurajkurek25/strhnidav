import "server-only";
import { and, eq, ne, or, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { communityBlocks, communityConversations, communityMessages } from "@/lib/db/schema";

// communityConversations.userAId is always the lexicographically smaller
// of the two profile ids, so a lookup never has to try both orderings.
export function sortedPair(a: string, b: string): [string, string] {
  return a < b ? [a, b] : [b, a];
}

// Blocking is one-directional to set up (A can block B without B's
// cooperation) but checked both ways everywhere it matters — a block
// always stops messages and hides content in both directions once
// either side has blocked the other.
export async function communityAreBlocked(userIdA: string, userIdB: string): Promise<boolean> {
  const [row] = await db
    .select({ id: communityBlocks.id })
    .from(communityBlocks)
    .where(
      or(
        and(eq(communityBlocks.blockerId, userIdA), eq(communityBlocks.blockedId, userIdB)),
        and(eq(communityBlocks.blockerId, userIdB), eq(communityBlocks.blockedId, userIdA))
      )
    );
  return Boolean(row);
}

// Read-only — for rendering an existing thread without creating one just
// because someone viewed it. Returns null if the two have never messaged.
export async function findConversation(userIdA: string, userIdB: string) {
  const [a, b] = sortedPair(userIdA, userIdB);
  const [existing] = await db
    .select()
    .from(communityConversations)
    .where(and(eq(communityConversations.userAId, a), eq(communityConversations.userBId, b)));
  return existing ?? null;
}

export async function getOrCreateConversation(userIdA: string, userIdB: string) {
  const [a, b] = sortedPair(userIdA, userIdB);

  const [existing] = await db
    .select()
    .from(communityConversations)
    .where(and(eq(communityConversations.userAId, a), eq(communityConversations.userBId, b)));
  if (existing) return existing;

  const [created] = await db
    .insert(communityConversations)
    .values({ userAId: a, userBId: b })
    .onConflictDoNothing({ target: [communityConversations.userAId, communityConversations.userBId] })
    .returning();
  if (created) return created;

  // Lost a race with another request creating the same pair between our
  // select and insert above — read back what it created.
  const [row] = await db
    .select()
    .from(communityConversations)
    .where(and(eq(communityConversations.userAId, a), eq(communityConversations.userBId, b)));
  return row;
}

// Called from the thread page on every view — marks anything the *other*
// person sent as read, never messages the viewer sent themselves.
export async function markMessagesRead(conversationId: string, viewerId: string): Promise<void> {
  await db
    .update(communityMessages)
    .set({ readAt: new Date() })
    .where(
      and(
        eq(communityMessages.conversationId, conversationId),
        ne(communityMessages.senderId, viewerId),
        sql`${communityMessages.readAt} is null`
      )
    );
}
