import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { stripe, COURSE_PRICE_EUR } from "@/lib/stripe";

export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("has_full_access, email")
    .eq("id", user.id)
    .single();

  if (profile?.has_full_access) {
    return NextResponse.json({ error: "already-purchased" }, { status: 400 });
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL!;
  const priceId = process.env.STRIPE_PRICE_ID;

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    client_reference_id: user.id,
    customer_email: profile?.email ?? user.email ?? undefined,
    metadata: { user_id: user.id },
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

  return NextResponse.json({ url: session.url });
}
