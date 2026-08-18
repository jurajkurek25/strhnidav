import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { courseSettings } from "@/lib/db/schema";

export async function getCoursePriceCents(): Promise<number> {
  const [row] = await db
    .select({ priceCents: courseSettings.priceCents })
    .from(courseSettings)
    .where(eq(courseSettings.id, true));
  return row?.priceCents ?? 29900;
}

export async function getCoursePriceEur(): Promise<number> {
  return (await getCoursePriceCents()) / 100;
}
