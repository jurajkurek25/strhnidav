"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { communityPosts, communityReports } from "@/lib/db/schema";

export async function resolveReport(reportId: string) {
  await requireAdmin();
  await db.update(communityReports).set({ resolvedAt: new Date() }).where(eq(communityReports.id, reportId));
  revalidatePath("/admin/community/reports");
}

export async function adminDeletePost(postId: string, reportId: string) {
  await requireAdmin();
  await db.delete(communityPosts).where(eq(communityPosts.id, postId));
  await db.update(communityReports).set({ resolvedAt: new Date() }).where(eq(communityReports.id, reportId));
  revalidatePath("/admin/community/reports");
  revalidatePath("/community");
}
