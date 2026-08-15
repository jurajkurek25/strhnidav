import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { profiles } from "@/lib/db/schema";
import { stripe, COURSE_PRICE_EUR } from "@/lib/stripe";

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  if (body?.consent !== true) {
    return NextResponse.json({ error: "consent-required" }, { status: 400 });
  }

  const [profile] = await db
    .select({ hasFullAccess: profiles.hasFullAccess, email: profiles.email })
    .from(profiles)
    .where(eq(profiles.id, session.user.id));

  if (profile?.hasFullAccess) {
    return NextResponse.json({ error: "already-purchased" }, { status: 400 });
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL!;
  const priceId = process.env.STRIPE_PRICE_ID;

  const checkoutSession = await stripe.checkout.sessions.create({
    mode: "payment",
    client_reference_id: session.user.id,
    customer_email: profile?.email ?? session.user.email ?? undefined,
    metadata: {
      user_id: session.user.id,
      // Checked before this request was sent — see UnlockButton's consent
      // checkbox and čl. 6 Obchodných podmienok.
      withdrawal_consent_at: new Date().toISOString(),
    },
    line_items: [
      priceId
        ? { price: priceId, quantity: 1 }
        : {
            quantity: 1,
            price_data: {
              currency: "eur",
              unit_amount: COURSE_PRICE_EUR * 100,
              product_data: {
                name: "Strhni Dav — celý kurz",
                description: "Doživotný prístup ku všetkým lekciám kurzu.",
              },
            },
          },
    ],
    success_url: `${siteUrl}/dashboard?purchase=success`,
    cancel_url: `${siteUrl}/dashboard/unlock?status=cancelled`,
  });

  return NextResponse.json({ url: checkoutSession.url });
}
