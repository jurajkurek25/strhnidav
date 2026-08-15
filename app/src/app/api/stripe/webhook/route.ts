import { NextResponse } from "next/server";
import Stripe from "stripe";
import { eq } from "drizzle-orm";
import { stripe } from "@/lib/stripe";
import { db } from "@/lib/db";
import { profiles, payments } from "@/lib/db/schema";

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

    if (userId) {
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
          amountCents: session.amount_total ?? 19900,
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

  return NextResponse.json({ received: true });
}
