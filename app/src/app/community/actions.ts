"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { requireProfile, requireCommunityProfile } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  profiles,
  communityPosts,
  communityBlocks,
  communityReports,
  communityMessages,
  type CommunityGender,
  type ReportTargetType,
} from "@/lib/db/schema";
import { communityAreBlocked, getOrCreateConversation } from "@/lib/community";

// Shown once at /community/onboarding — separate from the course-content
// audience preference (src/app/onboarding/actions.ts), since this is
// about who someone is in the community, not which Lessons unlock for
// them.
export async function setCommunityProfile(formData: FormData) {
  const profile = await requireProfile();

  const rawGender = String(formData.get("community_gender") ?? "");
  if (rawGender !== "men" && rawGender !== "women") {
    throw new Error("Neplatná voľba.");
  }
  const bio = String(formData.get("bio") ?? "").trim() || null;

  await db
    .update(profiles)
    .set({ communityGender: rawGender as CommunityGender, bio })
    .where(eq(profiles.id, profile.id));

  redirect("/community");
}

export async function updateBio(formData: FormData) {
  const profile = await requireCommunityProfile();
  const bio = String(formData.get("bio") ?? "").trim() || null;
  await db.update(profiles).set({ bio }).where(eq(profiles.id, profile.id));
  revalidatePath(`/community/profile/${profile.id}`);
  revalidatePath("/community");
}

// ---------------------------------------------------------------------------
// feed
// ---------------------------------------------------------------------------
export async function createPost(formData: FormData) {
  const profile = await requireCommunityProfile();
  const body = String(formData.get("body") ?? "").trim();
  if (!body) return;

  await db.insert(communityPosts).values({ userId: profile.id, body });
  revalidatePath("/community");
}

export async function deletePost(postId: string) {
  const profile = await requireCommunityProfile();
  await db
    .delete(communityPosts)
    .where(and(eq(communityPosts.id, postId), eq(communityPosts.userId, profile.id)));
  revalidatePath("/community");
}

// ---------------------------------------------------------------------------
// block / report — the safety valves. A block is one user's own choice and
// takes effect immediately with no admin involvement; a report only ever
// surfaces content to an admin at /admin/community/reports for manual
// review, never auto-hides anything on its own.
// ---------------------------------------------------------------------------
export async function blockUser(blockedId: string) {
  const profile = await requireCommunityProfile();
  if (blockedId === profile.id) return;
  await db.insert(communityBlocks).values({ blockerId: profile.id, blockedId }).onConflictDoNothing();
  revalidatePath("/community");
  revalidatePath(`/community/profile/${blockedId}`);
  revalidatePath("/community/messages");
}

export async function unblockUser(blockedId: string) {
  const profile = await requireCommunityProfile();
  await db
    .delete(communityBlocks)
    .where(and(eq(communityBlocks.blockerId, profile.id), eq(communityBlocks.blockedId, blockedId)));
  revalidatePath(`/community/profile/${blockedId}`);
}

export async function reportContent(targetType: ReportTargetType, targetId: string, formData: FormData) {
  const profile = await requireCommunityProfile();
  const reason = String(formData.get("reason") ?? "").trim() || null;
  await db.insert(communityReports).values({ reporterId: profile.id, targetType, targetId, reason });
  revalidatePath("/community");
}

// ---------------------------------------------------------------------------
// direct messages
// ---------------------------------------------------------------------------
export async function sendMessage(recipientId: string, formData: FormData) {
  const profile = await requireCommunityProfile();
  const body = String(formData.get("body") ?? "").trim();
  if (!body || recipientId === profile.id) return;

  if (await communityAreBlocked(profile.id, recipientId)) {
    throw new Error("Tomuto používateľovi nemôžeš napísať správu.");
  }

  const conversation = await getOrCreateConversation(profile.id, recipientId);
  if (!conversation) throw new Error("Nepodarilo sa otvoriť konverzáciu.");

  await db.insert(communityMessages).values({ conversationId: conversation.id, senderId: profile.id, body });
  revalidatePath(`/community/messages/${recipientId}`);
  revalidatePath("/community/messages");
}
