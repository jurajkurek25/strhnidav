import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { courseSettings } from "@/lib/db/schema";

async function getRow() {
  const [row] = await db
    .select({ priceCents: courseSettings.priceCents, subscriptionPriceCents: courseSettings.subscriptionPriceCents })
    .from(courseSettings)
    .where(eq(courseSettings.id, true));
  return { priceCents: row?.priceCents ?? 29900, subscriptionPriceCents: row?.subscriptionPriceCents ?? 2990 };
}

export async function getCoursePriceCents(): Promise<number> {
  return (await getRow()).priceCents;
}

export async function getCoursePriceEur(): Promise<number> {
  return (await getCoursePriceCents()) / 100;
}

export async function getSubscriptionPriceCents(): Promise<number> {
  return (await getRow()).subscriptionPriceCents;
}

export async function getSubscriptionPriceEur(): Promise<number> {
  return (await getSubscriptionPriceCents()) / 100;
}
