"use server";

import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { profiles } from "@/lib/db/schema";
import type { AudiencePreference } from "@/lib/db/schema";

export async function setAudiencePreference(formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const value = String(formData.get("audience_preference") ?? "");
  if (value !== "men" && value !== "women" && value !== "both") {
    throw new Error("Neplatná voľba.");
  }

  await db
    .update(profiles)
    .set({ audiencePreference: value as AudiencePreference })
    .where(eq(profiles.id, session.user.id));

  redirect("/dashboard");
}
