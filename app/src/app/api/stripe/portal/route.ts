import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { stripe } from "@/lib/stripe";
import { stripeCustomerIdForUser } from "@/lib/subscriptions";

// Self-service subscription management (cancel, update payment method, see
// invoices) via Stripe's hosted Customer Portal, so a subscriber never has
// to email support just to cancel. Requires the portal to be configured
// once in the Stripe Dashboard (Settings → Billing → Customer portal) —
// without that, this call fails with a Stripe error telling you so.
export async function POST() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const customerId = await stripeCustomerIdForUser(session.user.id);
  if (!customerId) return NextResponse.json({ error: "no-subscription" }, { status: 404 });

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL!;
  const portalSession = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: `${siteUrl}/dashboard`,
  });

  return NextResponse.json({ url: portalSession.url });
}
