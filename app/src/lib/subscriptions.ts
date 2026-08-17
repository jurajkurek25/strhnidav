import "server-only";
import { and, desc, eq, or } from "drizzle-orm";
import { db } from "@/lib/db";
import { subscriptions } from "@/lib/db/schema";

/**
 * True if the user currently has a live (active or trialing) subscription.
 * Deliberately never written into profiles.hasFullAccess — that column
 * keeps meaning exactly what it always has (a one-time purchase, a free
 * grant, or an admin toggle), so a lapsed subscription can never clobber
 * access someone has some other, permanent way. Every place that needs to
 * know "can this person see paid content right now" ORs this in instead.
 */
export async function hasActiveSubscription(userId: string): Promise<boolean> {
  const [row] = await db
    .select({ id: subscriptions.id })
    .from(subscriptions)
    .where(
      and(
        eq(subscriptions.userId, userId),
        or(eq(subscriptions.status, "active"), eq(subscriptions.status, "trialing"))
      )
    );
  return Boolean(row);
}

/**
 * The Stripe customer id to open a billing-portal session for — from the
 * most recent subscription this user has ever had, regardless of its
 * current status (a lapsed/canceled subscriber can still open the portal
 * to see invoices or resubscribe).
 */
export async function stripeCustomerIdForUser(userId: string): Promise<string | null> {
  const [row] = await db
    .select({ stripeCustomerId: subscriptions.stripeCustomerId })
    .from(subscriptions)
    .where(eq(subscriptions.userId, userId))
    .orderBy(desc(subscriptions.createdAt))
    .limit(1);
  return row?.stripeCustomerId ?? null;
}
