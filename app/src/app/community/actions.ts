"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { requireProfile, requireCommunityProfile } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  profiles,
  communityPosts,
  communityPostAttachments,
  communityComments,
  communityBlocks,
  communityReports,
  communityMessages,
  type CommunityGender,
  type ReportTargetType,
} from "@/lib/db/schema";
import { communityAreBlocked, getOrCreateConversation, classifyAttachment } from "@/lib/community";
import { writeStorageFile, deleteStorageDir, sanitizeFilename } from "@/lib/storage";

// Per-file cap on post attachments — generous for photos/PDFs/short clips
// while keeping a runaway upload from filling the server's disk, since
// this is open to every logged-in member (including free-tier) with no
// review before it lands on disk.
const MAX_ATTACHMENT_BYTES = 25 * 1024 * 1024;

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
  const files = formData.getAll("attachments").filter((f): f is File => f instanceof File && f.size > 0);
  if (!body && files.length === 0) return;

  const [post] = await db
    .insert(communityPosts)
    .values({ userId: profile.id, body })
    .returning({ id: communityPosts.id });
  if (!post) return;

  let orderIndex = 0;
  for (const file of files) {
    // Silently skipped rather than rejecting the whole post — the other
    // attachments and the caption still deserve to go through.
    if (file.size > MAX_ATTACHMENT_BYTES) continue;
    const buffer = Buffer.from(await file.arrayBuffer());
    const relPath = `community-posts/${post.id}/${Date.now()}-${sanitizeFilename(file.name)}`;
    await writeStorageFile(`public/${relPath}`, buffer);
    await db.insert(communityPostAttachments).values({
      postId: post.id,
      filePath: relPath,
      fileName: file.name,
      mimeType: file.type || "application/octet-stream",
      kind: classifyAttachment(file.type || ""),
      orderIndex: orderIndex++,
    });
  }

  revalidatePath("/community");
}

export async function deletePost(postId: string) {
  const profile = await requireCommunityProfile();
  const [deleted] = await db
    .delete(communityPosts)
    .where(and(eq(communityPosts.id, postId), eq(communityPosts.userId, profile.id)))
    .returning({ id: communityPosts.id });
  if (deleted) await deleteStorageDir(`public/community-posts/${postId}`);
  revalidatePath("/community");
}

// ---------------------------------------------------------------------------
// comments
// ---------------------------------------------------------------------------
export async function createComment(postId: string, formData: FormData) {
  const profile = await requireCommunityProfile();
  const body = String(formData.get("body") ?? "").trim();
  if (!body) return;

  await db.insert(communityComments).values({ postId, userId: profile.id, body });
  revalidatePath("/community");
}

export async function deleteComment(commentId: string) {
  const profile = await requireCommunityProfile();
  await db
    .delete(communityComments)
    .where(and(eq(communityComments.id, commentId), eq(communityComments.userId, profile.id)));
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
