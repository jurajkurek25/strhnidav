"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { communityPosts, communityComments, communityReports, profiles } from "@/lib/db/schema";
import { deleteStorageDir } from "@/lib/storage";

export async function resolveReport(reportId: string) {
  await requireAdmin();
  await db.update(communityReports).set({ resolvedAt: new Date() }).where(eq(communityReports.id, reportId));
  revalidatePath("/admin/community/reports");
}

export async function adminDeletePost(postId: string, reportId: string) {
  await requireAdmin();
  await db.delete(communityPosts).where(eq(communityPosts.id, postId));
  await deleteStorageDir(`public/community-posts/${postId}`);
  await db.update(communityReports).set({ resolvedAt: new Date() }).where(eq(communityReports.id, reportId));
  revalidatePath("/admin/community/reports");
  revalidatePath("/community");
}

export async function adminDeleteComment(commentId: string, reportId: string) {
  await requireAdmin();
  await db.delete(communityComments).where(eq(communityComments.id, commentId));
  await db.update(communityReports).set({ resolvedAt: new Date() }).where(eq(communityReports.id, reportId));
  revalidatePath("/admin/community/reports");
  revalidatePath("/community");
}

// Whether a member shows up in /community/members — doesn't touch their
// ability to post, comment, or message, only their visibility in the
// directory other members browse.
export async function toggleCommunityListed(userId: string, currentlyListed: boolean) {
  await requireAdmin();
  await db.update(profiles).set({ communityListed: !currentlyListed }).where(eq(profiles.id, userId));
  revalidatePath("/admin/community/members");
  revalidatePath("/community/members");
}
