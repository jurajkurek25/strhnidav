import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { profiles } from "@/lib/db/schema";
import { Logo } from "@/components/Logo";
import { setAudiencePreference } from "@/app/onboarding/actions";

const OPTIONS: { value: "men" | "women" | "both"; label: string; description: string }[] = [
  {
    value: "men",
    label: "Muži",
    description: "Lekcie pre mužov sa ti odomykajú deň po dni. Lekcie pre ženy máš k dispozícii voľne, kedykoľvek.",
  },
  {
    value: "women",
    label: "Ženy",
    description: "Lekcie pre ženy sa ti odomykajú deň po dni. Lekcie pre mužov máš k dispozícii voľne, kedykoľvek.",
  },
  {
    value: "both",
    label: "Obe",
    description: "Všetky lekcie — pre mužov aj pre ženy — sa ti odomykajú spoločne, deň po dni, presne v poradí kurzu.",
  },
];

// Shown once, right after a member's first sign-in — see requireProfile()
// in src/lib/auth.ts, which redirects here whenever audience_preference is
// still null. Not gated through requireProfile() itself (that would loop
// straight back here); this page does its own minimal check instead, and
// simply moves an already-answered member (or an admin) straight on.
export default async function AudiencePreferencePage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const [profile] = await db
    .select({ isAdmin: profiles.isAdmin, audiencePreference: profiles.audiencePreference })
    .from(profiles)
    .where(eq(profiles.id, session.user.id));

  if (!profile) redirect("/login");
  if (profile.isAdmin) redirect("/admin");
  if (profile.audiencePreference !== null) redirect("/dashboard");

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
      <div className="card" style={{ padding: "48px", maxWidth: 520, width: "100%" }}>
        <div style={{ marginBottom: 22 }}>
          <Logo size={34} iconOnly />
        </div>
        <div className="eyebrow" style={{ marginBottom: 22 }}>
          Predtým než začneš
        </div>
        <h1
          style={{
            fontFamily: "var(--font-display)",
            fontWeight: 600,
            fontSize: 28,
            lineHeight: 1.2,
            marginBottom: 14,
          }}
        >
          Kurz obsahuje aj obsah špecificky pre mužov a pre ženy.
        </h1>
        <p style={{ color: "var(--muted)", fontSize: 15, lineHeight: 1.65, marginBottom: 30 }}>
          Vyber si, ktorý z nich sa ti má odomykať postupne spolu s hlavným kurzom — deň po dni —
          a ktorý si chceš mať k dispozícii voľne, bez čakania, kedykoľvek.
        </p>

        <form action={setAudiencePreference} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {OPTIONS.map((option) => (
            <label
              key={option.value}
              className="card"
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 6,
                padding: "18px 20px",
                cursor: "pointer",
              }}
            >
              <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <input type="radio" name="audience_preference" value={option.value} required className="h-4 w-4" />
                <span className="font-display" style={{ fontWeight: 600, fontSize: 16 }}>
                  {option.label}
                </span>
              </span>
              <span style={{ color: "var(--muted)", fontSize: 13.5, lineHeight: 1.55 }}>{option.description}</span>
            </label>
          ))}

          <button type="submit" className="btn" style={{ marginTop: 8 }}>
            Pokračovať
          </button>
        </form>
      </div>
    </main>
  );
}
