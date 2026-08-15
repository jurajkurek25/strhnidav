import { NextResponse } from "next/server";
import Stripe from "stripe";
import { stripe } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/admin";

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
      const admin = createAdminClient();
      const now = new Date().toISOString();

      await admin
        .from("profiles")
        .update({ has_full_access: true, purchased_at: now })
        .eq("id", userId);

      await admin.from("payments").upsert(
        {
          user_id: userId,
          stripe_session_id: session.id,
          stripe_payment_intent:
            typeof session.payment_intent === "string" ? session.payment_intent : null,
          amount_cents: session.amount_total ?? 19900,
          currency: session.currency ?? "eur",
          status: "paid",
        },
        { onConflict: "stripe_session_id" }
      );
    }
  }

  return NextResponse.json({ received: true });
}
