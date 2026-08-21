import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { profiles, sections, sectionPurchases } from "@/lib/db/schema";
import { stripe } from "@/lib/stripe";
import { hasActiveSubscription } from "@/lib/subscriptions";
import { getCoursePriceCents, getSubscriptionPriceCents } from "@/lib/course-settings";

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const sectionId: string | undefined =
    typeof body?.sectionId === "string" ? body.sectionId : undefined;
  const isSubscription = body?.plan === "subscription";
  const isGiftCard = body?.giftCard === true;
  const giftKind: "course" | "section" | undefined =
    body?.giftKind === "course" || body?.giftKind === "section" ? body.giftKind : undefined;

  // The čl. 7 digital-content withdrawal-right consent only makes sense
  // when the buyer themselves is about to receive immediate access to
  // Lessons — a gift-card buyer never accesses anything themselves (the
  // redeemer does, later, separately), so /dashboard/gift doesn't show
  // that checkbox and this request never carries consent:true.
  if (!isGiftCard && body?.consent !== true) {
    return NextResponse.json({ error: "consent-required" }, { status: 400 });
  }

  const [profile] = await db
    .select({ hasFullAccess: profiles.hasFullAccess, email: profiles.email })
    .from(profiles)
    .where(eq(profiles.id, session.user.id));

  // A gift card is for someone else — the buyer's own access status is
  // irrelevant, so this is the one purchase type that skips the
  // "already purchased" gate below.
  if (!isGiftCard && (profile?.hasFullAccess || (await hasActiveSubscription(session.user.id)))) {
    return NextResponse.json({ error: "already-purchased" }, { status: 400 });
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL!;

  const withdrawalConsentAt = new Date().toISOString();
  const commonFields = {
    mode: "payment" as const,
    client_reference_id: session.user.id,
    customer_email: profile?.email ?? session.user.email ?? undefined,
    // Shows a "Add promotion code" field on the Stripe-hosted checkout page.
    // Codes themselves are created/managed in the Stripe Dashboard
    // (Product catalog → Coupons / Promotion codes) — nothing else to wire
    // up here.
    allow_promotion_codes: true,
  };

  if (isGiftCard) {
    if (giftKind === "section") {
      if (!sectionId) return NextResponse.json({ error: "not-found" }, { status: 404 });
      const [section] = await db.select().from(sections).where(eq(sections.id, sectionId));
      if (!section) return NextResponse.json({ error: "not-found" }, { status: 404 });

      const checkoutSession = await stripe.checkout.sessions.create({
        ...commonFields,
        metadata: {
          user_id: session.user.id,
          gift_card: "true",
          gift_kind: "section",
          gift_section_id: sectionId,
        },
        line_items: [
          {
            quantity: 1,
            price_data: {
              currency: "eur",
              unit_amount: section.priceCents,
              product_data: {
                name: `Strhni Dav — darček: blok „${section.title}“`,
                description: "Darčeková karta na prístup k jednému bloku kurzu.",
              },
            },
          },
        ],
        success_url: `${siteUrl}/dashboard/gift?purchase=success`,
        cancel_url: `${siteUrl}/dashboard/gift?status=cancelled`,
      });

      return NextResponse.json({ url: checkoutSession.url });
    }

    if (giftKind === "course") {
      const checkoutSession = await stripe.checkout.sessions.create({
        ...commonFields,
        metadata: {
          user_id: session.user.id,
          gift_card: "true",
          gift_kind: "course",
        },
        line_items: [
          {
            quantity: 1,
            price_data: {
              currency: "eur",
              unit_amount: await getCoursePriceCents(),
              product_data: {
                name: "Strhni Dav — darček: celý kurz",
                description: "Darčeková karta na doživotný prístup k celému kurzu.",
              },
            },
          },
        ],
        success_url: `${siteUrl}/dashboard/gift?purchase=success`,
        cancel_url: `${siteUrl}/dashboard/gift?status=cancelled`,
      });

      return NextResponse.json({ url: checkoutSession.url });
    }

    return NextResponse.json({ error: "invalid-gift" }, { status: 400 });
  }

  if (isSubscription) {
    const checkoutSession = await stripe.checkout.sessions.create({
      ...commonFields,
      mode: "subscription",
      metadata: {
        user_id: session.user.id,
        withdrawal_consent_at: withdrawalConsentAt,
      },
      // Copied onto the created Subscription object itself, so later
      // customer.subscription.updated/deleted webhook events (which carry
      // no checkout-session metadata of their own) can still be traced back
      // to a user even before our own `subscriptions` row exists.
      subscription_data: {
        metadata: { user_id: session.user.id },
      },
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "eur",
            unit_amount: await getSubscriptionPriceCents(),
            recurring: { interval: "month" },
            product_data: {
              name: "Strhni Dav — mesačné predplatné",
              description: "Prístup ku kurzu, dokým je predplatné aktívne. Zrušiteľné kedykoľvek.",
            },
          },
        },
      ],
      success_url: `${siteUrl}/dashboard?purchase=success`,
      cancel_url: `${siteUrl}/dashboard/unlock?status=cancelled`,
    });

    return NextResponse.json({ url: checkoutSession.url });
  }

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
            unit_amount: section.priceCents,
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

  const checkoutSession = await stripe.checkout.sessions.create({
    ...commonFields,
    metadata: {
      user_id: session.user.id,
      // Checked before this request was sent — see UnlockOptions' consent
      // checkbox and čl. 7 Obchodných podmienok.
      withdrawal_consent_at: withdrawalConsentAt,
    },
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: "eur",
          unit_amount: await getCoursePriceCents(),
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
