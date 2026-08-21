import "server-only";
import { randomBytes } from "crypto";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { giftCards } from "@/lib/db/schema";

// Alphabet excludes visually-ambiguous characters (0/O, 1/I/L) since this
// code is meant to be typed in by hand off a printed or shared gift card.
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

function randomSegment(length: number): string {
  const bytes = randomBytes(length);
  let out = "";
  for (let i = 0; i < length; i++) out += ALPHABET[bytes[i] % ALPHABET.length];
  return out;
}

// SD-XXXX-XXXX-XXXX — collision-checked against the DB, matching the
// retry-until-free pattern already used by uniqueSlug() in
// src/app/admin/actions.ts.
export async function generateUniqueGiftCardCode(): Promise<string> {
  for (let attempt = 0; attempt < 20; attempt++) {
    const candidate = `SD-${randomSegment(4)}-${randomSegment(4)}-${randomSegment(4)}`;
    const [existing] = await db.select({ id: giftCards.id }).from(giftCards).where(eq(giftCards.code, candidate));
    if (!existing) return candidate;
  }
  throw new Error("Nepodarilo sa vygenerovať jedinečný kód darčekovej karty.");
}
