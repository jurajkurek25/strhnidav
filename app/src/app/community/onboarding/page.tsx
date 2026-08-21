import { redirect } from "next/navigation";
import { requireProfile } from "@/lib/auth";
import { Logo } from "@/components/Logo";
import { setCommunityProfile } from "@/app/community/actions";

// Shown once, right before a member's first visit to /community — see
// requireCommunityProfile() in src/lib/auth.ts. Uses requireProfile()
// (not requireCommunityProfile) so it never redirects back to itself.
export default async function CommunityOnboardingPage() {
  const profile = await requireProfile();
  if (profile.communityGender !== null) redirect("/community");

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
          Predtým než vstúpiš do komunity
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
          Nastav si komunitný profil.
        </h1>
        <p style={{ color: "var(--muted)", fontSize: 15, lineHeight: 1.65, marginBottom: 30 }}>
          Komunita je spoločný priestor pre členov kurzu — feed príspevkov, súkromné správy a
          AI odporúčania, koho by malo zmysel spoznať. Toto nastavenie je nezávislé od tvojej
          skoršej voľby, ktoré Lekcie sa ti odomykajú — tu ide o to, ako ťa uvidia ostatní a s kým
          ťa má zmysel spájať.
        </p>

        <form action={setCommunityProfile} style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <fieldset style={{ display: "flex", flexDirection: "column", gap: 10, border: "none", padding: 0 }}>
            <legend className="font-label" style={{ fontSize: 13, textTransform: "uppercase", marginBottom: 4 }}>
              Si
            </legend>
            <label className="card" style={{ display: "flex", alignItems: "center", gap: 10, padding: "14px 18px" }}>
              <input type="radio" name="community_gender" value="men" required className="h-4 w-4" />
              <span className="font-display" style={{ fontWeight: 600 }}>
                Muž
              </span>
            </label>
            <label className="card" style={{ display: "flex", alignItems: "center", gap: 10, padding: "14px 18px" }}>
              <input type="radio" name="community_gender" value="women" required className="h-4 w-4" />
              <span className="font-display" style={{ fontWeight: 600 }}>
                Žena
              </span>
            </label>
          </fieldset>

          <label className="flex flex-col gap-2.5 text-sm text-muted">
            Krátke predstavenie (nepovinné, uvidia ho ostatní členovia)
            <textarea name="bio" rows={3} placeholder="Napíš pár viet o sebe…" />
          </label>

          <button type="submit" className="btn">
            Pokračovať do komunity
          </button>
        </form>
      </div>
    </main>
  );
}
