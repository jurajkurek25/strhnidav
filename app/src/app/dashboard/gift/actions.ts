"use server";

import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { requireProfile } from "@/lib/auth";
import { db } from "@/lib/db";
import { giftCards, profiles, sectionPurchases } from "@/lib/db/schema";

export async function redeemGiftCard(formData: FormData) {
  const profile = await requireProfile();
  const rawCode = String(formData.get("code") ?? "").trim().toUpperCase();

  function fail(reason: string): never {
    redirect(`/dashboard/gift?redeemError=${encodeURIComponent(reason)}`);
  }

  if (!rawCode) fail("Zadaj kód darčekovej karty.");

  const [card] = await db.select().from(giftCards).where(eq(giftCards.code, rawCode));
  if (!card) fail("Kód sme nenašli. Skontroluj, či je zadaný správne.");
  if (card.status !== "paid") fail("Táto darčeková karta ešte nie je pripravená na aktiváciu.");
  if (card.redeemedAt) fail("Táto darčeková karta už bola aktivovaná.");

  if (card.kind === "course") {
    if (profile.hasFullAccess) fail("Plný prístup ku kurzu už máš — táto karta sa ti nezíde, daj ju niekomu inému.");
    await db
      .update(profiles)
      .set({ hasFullAccess: true, purchasedAt: new Date() })
      .where(eq(profiles.id, profile.id));
  } else {
    if (!card.sectionId) fail("Táto darčeková karta nemá priradený blok.");
    const [already] = await db
      .select({ id: sectionPurchases.id })
      .from(sectionPurchases)
      .where(
        and(
          eq(sectionPurchases.userId, profile.id),
          eq(sectionPurchases.sectionId, card.sectionId),
          eq(sectionPurchases.status, "paid")
        )
      );
    if (already) fail("Tento blok už máš zakúpený.");
    await db.insert(sectionPurchases).values({
      userId: profile.id,
      sectionId: card.sectionId,
      amountCents: card.amountCents,
      currency: card.currency,
      status: "paid",
    });
  }

  await db
    .update(giftCards)
    .set({ redeemedAt: new Date(), redeemedByUserId: profile.id })
    .where(eq(giftCards.id, card.id));

  redirect("/dashboard/gift?redeemSuccess=1");
}
