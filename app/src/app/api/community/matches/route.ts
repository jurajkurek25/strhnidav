import { NextResponse } from "next/server";
import { and, eq, isNotNull, ne, sql } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { profiles, communityBlocks } from "@/lib/db/schema";
import { suggestMatches } from "@/lib/ai-match";

const oppositeOf = { men: "women", women: "men" } as const;

export async function POST() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const [profile] = await db
    .select({ id: profiles.id, bio: profiles.bio, communityGender: profiles.communityGender })
    .from(profiles)
    .where(eq(profiles.id, session.user.id));
  if (!profile || profile.communityGender === null) {
    return NextResponse.json({ error: "no-community-profile" }, { status: 400 });
  }
  if (!profile.bio) {
    return NextResponse.json({ error: "no-bio" }, { status: 400 });
  }

  const [blocksIMade, blocksOnMe] = await Promise.all([
    db.select({ id: communityBlocks.blockedId }).from(communityBlocks).where(eq(communityBlocks.blockerId, profile.id)),
    db.select({ id: communityBlocks.blockerId }).from(communityBlocks).where(eq(communityBlocks.blockedId, profile.id)),
  ]);
  const excluded = new Set([...blocksIMade.map((b) => b.id), ...blocksOnMe.map((b) => b.id)]);

  const rawCandidates = await db
    .select({
      id: profiles.id,
      fullName: profiles.fullName,
      avatarUrl: profiles.avatarUrl,
      bio: profiles.bio,
    })
    .from(profiles)
    .where(
      and(
        eq(profiles.communityGender, oppositeOf[profile.communityGender]),
        isNotNull(profiles.bio),
        ne(sql`coalesce(${profiles.bio}, '')`, "")
      )
    )
    .limit(30);

  const candidates = rawCandidates.filter((c) => !excluded.has(c.id));
  if (candidates.length === 0) {
    return NextResponse.json({ suggestions: [] });
  }

  const suggestions = await suggestMatches(
    profile.bio,
    candidates.map((c) => ({ id: c.id, name: c.fullName ?? "Člen", bio: c.bio! }))
  );

  const byId = new Map(candidates.map((c) => [c.id, c]));
  const enriched = suggestions
    .map((s) => {
      const c = byId.get(s.id);
      if (!c) return null;
      return { id: s.id, score: s.score, reason: s.reason, name: c.fullName ?? "Člen", avatarUrl: c.avatarUrl };
    })
    .filter((s): s is NonNullable<typeof s> => s !== null)
    .sort((a, b) => b.score - a.score);

  return NextResponse.json({ suggestions: enriched });
}
