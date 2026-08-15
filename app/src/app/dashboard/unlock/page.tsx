import { redirect } from "next/navigation";
import { requireProfile } from "@/lib/auth";
import { Header } from "@/components/Header";
import { UnlockButton } from "@/components/UnlockButton";

export default async function UnlockPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const profile = await requireProfile();
  const { status } = await searchParams;

  if (profile.hasFullAccess) redirect("/dashboard");

  return (
    <>
      <Header
        name={profile.fullName}
        avatarUrl={profile.avatarUrl}
        isAdmin={profile.isAdmin}
        hasFullAccess={profile.hasFullAccess}
      />
      <main className="wrap py-24">
        <div className="eyebrow mb-6">Vstup do kurzu</div>
        <h1 className="font-display text-[clamp(28px,4vw,40px)] font-semibold max-w-[16ch]">
          Odomkni zvyšok kurzu.
        </h1>

        {status === "cancelled" && (
          <p className="mt-6 text-sm text-[#d98d8d]">
            Platba bola zrušená — skús to znova, keď budeš pripravený.
          </p>
        )}

        <div className="card mt-12 grid gap-12 p-12 md:grid-cols-[1fr_360px] md:items-start">
          <div>
            <div className="font-display text-[clamp(48px,6vw,72px)] font-semibold leading-none text-gold-bright">
              199<span className="ml-2 font-body text-[0.35em] font-medium text-muted">€ / celý kurz</span>
            </div>
            <ul className="mt-8 flex flex-col gap-3">
              {[
                "Prístup ku všetkým lekciám kurzu",
                "Ďalšie lekcie sa naďalej odomykajú deň po dni podľa tvojho postupu",
                "Diskusia, dokumenty a audio ku každej lekcii",
                "Konkrétne akčné kroky pri každej lekcii",
                "Overiteľný certifikát o úspešnom absolvovaní kurzu",
              ].map((li) => (
                <li key={li} className="flex gap-3.5 text-[15px] text-muted">
                  <span className="text-gold">—</span>
                  {li}
                </li>
              ))}
            </ul>
          </div>
          <UnlockButton />
        </div>
      </main>
    </>
  );
}
