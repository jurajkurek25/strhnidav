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

  if (profile.has_full_access) redirect("/dashboard");

  return (
    <>
      <Header
        name={profile.full_name}
        avatarUrl={profile.avatar_url}
        isAdmin={profile.is_admin}
        hasFullAccess={profile.has_full_access}
      />
      <main className="wrap py-16">
        <div className="eyebrow mb-4">Vstup do kurzu</div>
        <h1 className="font-display text-[clamp(28px,4vw,40px)] font-semibold max-w-[16ch]">
          Odomkni zvyšok kurzu.
        </h1>

        {status === "cancelled" && (
          <p className="mt-4 text-sm text-[#d98d8d]">
            Platba bola zrušená — skús to znova, keď budeš pripravený.
          </p>
        )}

        <div className="card mt-10 grid gap-10 p-10 sm:grid-cols-[1fr_auto] sm:items-center">
          <div>
            <div className="font-display text-[clamp(48px,6vw,72px)] font-semibold leading-none text-gold-bright">
              199<span className="ml-1 font-body text-[0.35em] font-medium text-muted">€ / celý kurz</span>
            </div>
            <ul className="mt-6 flex flex-col gap-2">
              {[
                "Prístup ku všetkým lekciám kurzu",
                "Ďalšie lekcie sa naďalej odomykajú deň po dni podľa tvojho postupu",
                "Diskusia, dokumenty a audio ku každej lekcii",
              ].map((li) => (
                <li key={li} className="flex gap-2.5 text-[15px] text-muted">
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
