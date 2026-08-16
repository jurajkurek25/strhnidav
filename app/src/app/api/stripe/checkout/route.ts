import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { profiles, sections, sectionPurchases } from "@/lib/db/schema";
import { stripe, COURSE_PRICE_EUR, BLOCK_PRICE_EUR } from "@/lib/stripe";

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  if (body?.consent !== true) {
    return NextResponse.json({ error: "consent-required" }, { status: 400 });
  }
  const sectionId: string | undefined =
    typeof body?.sectionId === "string" ? body.sectionId : undefined;

  const [profile] = await db
    .select({ hasFullAccess: profiles.hasFullAccess, email: profiles.email })
    .from(profiles)
    .where(eq(profiles.id, session.user.id));

  if (profile?.hasFullAccess) {
    return NextResponse.json({ error: "already-purchased" }, { status: 400 });
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL!;

  const withdrawalConsentAt = new Date().toISOString();
  const commonFields = {
    mode: "payment" as const,
    client_reference_id: session.user.id,
    customer_email: profile?.email ?? session.user.email ?? undefined,
  };

  if (sectionId) {
    const [section] = await db.select().from(sections).where(eq(sections.id, sectionId));
    if (!section) return NextResponse.json({ error: "not-found" }, { status: 404 });

    const [alreadyPaid] = await db
      .select({ id: sectionPurchases.id })
      .from(sectionPurchases)
      .where(
        and(
          eq(sectionPurchases.userId, session.user.id),
          eq(sectionPurchases.sectionId, sectionId),
          eq(sectionPurchases.status, "paid")
        )
      );
    if (alreadyPaid) {
      return NextResponse.json({ error: "already-purchased" }, { status: 400 });
    }

    const checkoutSession = await stripe.checkout.sessions.create({
      ...commonFields,
      metadata: {
        user_id: session.user.id,
        section_id: sectionId,
        withdrawal_consent_at: withdrawalConsentAt,
      },
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "eur",
            unit_amount: BLOCK_PRICE_EUR * 100,
            product_data: {
              name: `Strhni Dav — blok „${section.title}“`,
              description: "Doživotný prístup ku všetkým lekciám tohto bloku.",
            },
          },
        },
      ],
      success_url: `${siteUrl}/dashboard?purchase=success`,
      cancel_url: `${siteUrl}/dashboard/unlock?status=cancelled`,
    });

    return NextResponse.json({ url: checkoutSession.url });
  }

  const priceId = process.env.STRIPE_PRICE_ID;

  const checkoutSession = await stripe.checkout.sessions.create({
    ...commonFields,
    metadata: {
      user_id: session.user.id,
      // Checked before this request was sent — see UnlockOptions' consent
      // checkbox and čl. 7 Obchodných podmienok.
      withdrawal_consent_at: withdrawalConsentAt,
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
