import { notFound, redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { sections, sectionPurchases, profiles } from "@/lib/db/schema";
import { hasActiveSubscription } from "@/lib/subscriptions";
import { Logo } from "@/components/Logo";
import { BuyBlockConsent } from "@/components/BuyBlockConsent";

// Direct sales link for a single block — e.g. for linking from an external
// landing page pitching just that block (kurz.strhnidav.sk/buy/randenie).
// src/proxy.ts already sends a signed-out visitor to /login?next=/buy/<slug>
// (see PROTECTED_PREFIXES there) and login/page.tsx + auth/actions.ts carry
// that `next` back here after Google sign-in, so this component only has
// to handle the already-authenticated cases.
export default async function BuySlugPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const [section] = await db.select().from(sections).where(eq(sections.slug, slug));
  if (!section) notFound();

  const session = await auth();
  if (!session?.user?.id) redirect(`/login?next=${encodeURIComponent(`/buy/${slug}`)}`);

  const [profile] = await db
    .select({ hasFullAccess: profiles.hasFullAccess })
    .from(profiles)
    .where(eq(profiles.id, session.user.id));

  const [alreadyPaid] = await db
    .select({ id: sectionPurchases.id })
    .from(sectionPurchases)
    .where(
      and(
        eq(sectionPurchases.userId, session.user.id),
        eq(sectionPurchases.sectionId, section.id),
        eq(sectionPurchases.status, "paid")
      )
    );

  if (profile?.hasFullAccess || alreadyPaid || (await hasActiveSubscription(session.user.id))) {
    redirect("/dashboard");
  }

  const priceEur = section.priceCents / 100;

  return (
    <main
      style={{
        minHeight: "100dvh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px",
      }}
    >
      <div className="card" style={{ padding: "48px", maxWidth: 440, width: "100%" }}>
        <div style={{ marginBottom: 22 }}>
          <Logo size={34} iconOnly />
        </div>
        <div className="eyebrow" style={{ marginBottom: 22 }}>
          Jeden blok kurzu
        </div>
        <h1
          style={{
            fontFamily: "var(--font-display)",
            fontWeight: 600,
            fontSize: 32,
            lineHeight: 1.15,
            marginBottom: 14,
          }}
        >
          {section.title}
        </h1>
        {section.description && (
          <p style={{ color: "var(--muted)", fontSize: 15, lineHeight: 1.65, marginBottom: 20 }}>
            {section.description}
          </p>
        )}
        <div
          style={{
            fontFamily: "var(--font-display)",
            fontSize: 40,
            fontWeight: 600,
            color: "var(--gold-bright)",
            marginBottom: 28,
          }}
        >
          {priceEur % 1 === 0 ? priceEur : priceEur.toFixed(2).replace(".", ",")} €
        </div>

        <BuyBlockConsent sectionId={section.id} />
      </div>
    </main>
  );
}
