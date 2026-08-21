import { NextResponse } from "next/server";
import Stripe from "stripe";
import { eq } from "drizzle-orm";
import { stripe } from "@/lib/stripe";
import { db } from "@/lib/db";
import { profiles, payments, sectionPurchases, subscriptions, giftCards, type SubscriptionStatus, type GiftCardKind } from "@/lib/db/schema";
import { generateUniqueGiftCardCode } from "@/lib/gift-cards";

function customerId(customer: string | Stripe.Customer | Stripe.DeletedCustomer | null): string | null {
  if (!customer) return null;
  return typeof customer === "string" ? customer : customer.id;
}

// Subscription webhook events carry no checkout-session metadata of their
// own — the user_id we stamped onto subscription_data.metadata at checkout
// time is the primary source, with our own table as a fallback for events
// that somehow arrive before that metadata is visible.
async function userIdForSubscription(subscription: Stripe.Subscription): Promise<string | null> {
  if (subscription.metadata?.user_id) return subscription.metadata.user_id;
  const [row] = await db
    .select({ userId: subscriptions.userId })
    .from(subscriptions)
    .where(eq(subscriptions.stripeSubscriptionId, subscription.id));
  return row?.userId ?? null;
}

async function upsertSubscriptionRow(subscription: Stripe.Subscription, status: SubscriptionStatus) {
  const userId = await userIdForSubscription(subscription);
  const custId = customerId(subscription.customer);
  if (!userId || !custId) return;

  const item = subscription.items.data[0];

  await db
    .insert(subscriptions)
    .values({
      userId,
      stripeCustomerId: custId,
      stripeSubscriptionId: subscription.id,
      status,
      amountCents: item?.price.unit_amount ?? 2990,
      currency: subscription.currency,
      currentPeriodEnd: item ? new Date(item.current_period_end * 1000) : null,
    })
    .onConflictDoUpdate({
      target: subscriptions.stripeSubscriptionId,
      set: {
        status,
        currentPeriodEnd: item ? new Date(item.current_period_end * 1000) : null,
        updatedAt: new Date(),
      },
    });
}

export async function POST(request: Request) {
  const signature = request.headers.get("stripe-signature");
  const rawBody = await request.text();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(
      rawBody,
      signature!,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (err) {
    console.error("stripe webhook signature verification failed", err);
    return NextResponse.json({ error: "invalid signature" }, { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const userId = session.client_reference_id ?? session.metadata?.user_id;
    const sectionId = session.metadata?.section_id;

    if (session.metadata?.gift_card === "true" && userId) {
      // Checked before the plain sectionId/course branches below — a gift
      // card must never fall through to those and grant the *buyer*
      // access; it grants a redeemable code instead, applied to whoever
      // redeems it later (see /dashboard/gift's redeemGiftCard action).
      const kind = session.metadata?.gift_kind as GiftCardKind | undefined;
      const giftSectionId = session.metadata?.gift_section_id ?? null;
      if (kind === "course" || kind === "section") {
        const code = await generateUniqueGiftCardCode();
        await db
          .insert(giftCards)
          .values({
            code,
            kind,
            sectionId: kind === "section" ? giftSectionId : null,
            amountCents: session.amount_total ?? 0,
            currency: session.currency ?? "eur",
            purchasedByUserId: userId,
            stripeSessionId: session.id,
            status: "paid",
          })
          .onConflictDoUpdate({
            target: giftCards.stripeSessionId,
            set: { status: "paid" },
          });
      }
    } else if (session.mode === "subscription" && userId && typeof session.subscription === "string") {
      const custId = customerId(session.customer);
      if (custId) {
        await db
          .insert(subscriptions)
          .values({
            userId,
            stripeCustomerId: custId,
            stripeSubscriptionId: session.subscription,
            status: "active",
            amountCents: session.amount_total ?? 2990,
            currency: session.currency ?? "eur",
          })
          .onConflictDoUpdate({
            target: subscriptions.stripeSubscriptionId,
            set: { status: "active", stripeCustomerId: custId, updatedAt: new Date() },
          });
      }
    } else if (userId && sectionId) {
      await db
        .insert(sectionPurchases)
        .values({
          userId,
          sectionId,
          stripeSessionId: session.id,
          stripePaymentIntent:
            typeof session.payment_intent === "string" ? session.payment_intent : null,
          amountCents: session.amount_total ?? 9900,
          currency: session.currency ?? "eur",
          status: "paid",
        })
        .onConflictDoUpdate({
          target: sectionPurchases.stripeSessionId,
          set: { status: "paid" },
        });
    } else if (userId) {
      const now = new Date();
      const consentAt = session.metadata?.withdrawal_consent_at;

      await db
        .update(profiles)
        .set({ hasFullAccess: true, purchasedAt: now })
        .where(eq(profiles.id, userId));

      await db
        .insert(payments)
        .values({
          userId,
          stripeSessionId: session.id,
          stripePaymentIntent:
            typeof session.payment_intent === "string" ? session.payment_intent : null,
          amountCents: session.amount_total ?? 29900,
          currency: session.currency ?? "eur",
          status: "paid",
          withdrawalConsentAt: consentAt ? new Date(consentAt) : null,
        })
        .onConflictDoUpdate({
          target: payments.stripeSessionId,
          set: { status: "paid" },
        });
    }
  }

  // Keeps our subscriptions table (the only thing subscription-derived
  // access is computed from — see src/lib/subscriptions.ts) in sync with
  // Stripe's view of the world: renewals, failed payments, and
  // cancellations all land here. Deliberately never touches
  // profiles.hasFullAccess directly.
  if (event.type === "customer.subscription.updated") {
    const subscription = event.data.object as Stripe.Subscription;
    await upsertSubscriptionRow(subscription, subscription.status as SubscriptionStatus);
  }

  if (event.type === "customer.subscription.deleted") {
    const subscription = event.data.object as Stripe.Subscription;
    await upsertSubscriptionRow(subscription, "canceled");
  }

  return NextResponse.json({ received: true });
}
