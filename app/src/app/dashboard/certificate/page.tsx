import Link from "next/link";
import QRCode from "qrcode";
import { requireProfile } from "@/lib/auth";
import { getLessonStatesForUser } from "@/lib/course";
import { getOrIssueCertificate } from "@/lib/certificate";
import { Header } from "@/components/Header";
import { CertificateCard } from "@/components/CertificateCard";
import { CertificatePrintButton } from "@/components/CertificatePrintButton";

export default async function CertificatePage() {
  const profile = await requireProfile();
  const states = await getLessonStatesForUser(profile.id, profile.effectiveFullAccess);
  const completedCount = states.filter((s) => s.state === "completed").length;
  const eligible = profile.effectiveFullAccess && states.length > 0 && completedCount === states.length;

  const headerProps = {
    name: profile.fullName,
    avatarUrl: profile.avatarUrl,
    isAdmin: profile.isAdmin,
    hasFullAccess: profile.effectiveFullAccess,
  };

  if (!eligible) {
    return (
      <>
        <Header {...headerProps} />
        <main className="wrap py-20">
          <div className="max-w-[520px]">
            <div className="eyebrow mb-6">Certifikát</div>
            <h1 className="font-display text-[clamp(28px,4vw,40px)] font-semibold leading-tight">
              Certifikát získaš po dokončení celého kurzu.
            </h1>
            <p className="mt-6 text-[15px] leading-relaxed text-muted">
              Máš splnených <b className="text-gold-bright">{completedCount}</b> / {states.length}{" "}
              lekcií
              {!profile.effectiveFullAccess && " a ešte nemáš plný prístup k celému kurzu"}. Certifikát o
              absolvovaní sa automaticky vygeneruje, keď dokončíš úplne poslednú lekciu.
            </p>
            <Link href="/dashboard" className="btn mt-10 inline-flex">
              Späť na kurz
            </Link>
          </div>
        </main>
      </>
    );
  }

  const certificate = await getOrIssueCertificate(profile.id, profile.fullName ?? profile.email);
  const verifyUrl = `${process.env.NEXT_PUBLIC_SITE_URL}/certifikat/${certificate.id}`;
  const qrDataUrl = await QRCode.toDataURL(verifyUrl, {
    width: 192,
    margin: 1,
    color: { dark: "#141110", light: "#f2ebda" },
  });

  return (
    <>
      <div className="no-print">
        <Header {...headerProps} />
      </div>
      <main className="wrap py-20">
        <div className="no-print mb-12 flex flex-wrap items-end justify-between gap-6">
          <div>
            <div className="eyebrow mb-6">Certifikát</div>
            <h1 className="font-display text-[clamp(28px,4vw,40px)] font-semibold leading-tight">
              Gratulujeme, kurz máš dokončený.
            </h1>
          </div>
          <CertificatePrintButton />
        </div>

        <CertificateCard
          fullName={certificate.fullName}
          issuedAt={certificate.issuedAt}
          id={certificate.id}
          qrDataUrl={qrDataUrl}
        />

        <p className="no-print mt-8 text-center text-[13px] text-muted">
          Pravosť tohto certifikátu je kedykoľvek overiteľná na{" "}
          <Link href="/certifikat" className="underline hover:text-cream">
            kurz.strhnidav.sk/certifikat
          </Link>
          .
        </p>
      </main>
    </>
  );
}
