import { requireCommunityProfile } from "@/lib/auth";
import { Header } from "@/components/Header";
import { CommunityNav } from "@/components/CommunityNav";
import { MatchFinder } from "@/components/MatchFinder";

export default async function CommunityMatchesPage() {
  const profile = await requireCommunityProfile();

  return (
    <>
      <Header
        name={profile.fullName}
        avatarUrl={profile.avatarUrl}
        isAdmin={profile.isAdmin}
        hasFullAccess={profile.effectiveFullAccess}
      />
      <main className="wrap py-16 max-w-2xl">
        <div className="eyebrow mb-6">Komunita</div>
        <h1 className="font-display text-[clamp(28px,4vw,38px)] font-semibold">AI zhody</h1>
        <CommunityNav active="/community/matches" />

        <p className="mb-8 max-w-[60ch] text-[14.5px] leading-relaxed text-muted">
          Na základe tvojho bio a bio ostatných členov ti AI navrhne, s kým by sa oplatilo sa
          spojiť. Návrhy vychádzajú výlučne z textu, ktorý si sami o sebe napíšete.
        </p>

        {profile.bio ? (
          <MatchFinder />
        ) : (
          <p className="text-sm text-muted">
            Najprv si doplň{" "}
            <a href={`/community/profile/${profile.id}`} className="text-gold-bright underline">
              bio vo svojom profile
            </a>
            , aby sme ti vedeli navrhnúť zhody.
          </p>
        )}
      </main>
    </>
  );
}
