import Link from "next/link";
import { getCertificateById } from "@/lib/certificate";
import { Logo } from "@/components/Logo";

const dateFormatter = new Intl.DateTimeFormat("sk-SK", {
  day: "numeric",
  month: "long",
  year: "numeric",
});

export const metadata = {
  title: "Overenie certifikátu — Strhni Dav",
};

export default async function CertifikatResultPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const certificate = await getCertificateById(id);

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
      <div className="card" style={{ padding: "48px", maxWidth: 480, width: "100%" }}>
        <div style={{ marginBottom: 22 }}>
          <Logo size={34} iconOnly />
        </div>
        <div className="eyebrow" style={{ marginBottom: 22 }}>
          Overenie pravosti
        </div>

        {certificate ? (
          <>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 26 }}>
              <span
                style={{
                  width: 9,
                  height: 9,
                  borderRadius: "50%",
                  background: "var(--good)",
                  flexShrink: 0,
                }}
              />
              <span
                style={{
                  fontFamily: "var(--font-label)",
                  fontWeight: 700,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  fontSize: 13,
                  color: "var(--good)",
                }}
              >
                Platný certifikát
              </span>
            </div>

            <dl style={{ display: "grid", gap: 18 }}>
              <div>
                <dt style={{ fontSize: 12.5, color: "var(--muted)", marginBottom: 4 }}>Držiteľ</dt>
                <dd
                  style={{
                    fontFamily: "var(--font-display)",
                    fontSize: 24,
                    fontWeight: 600,
                    color: "var(--cream)",
                  }}
                >
                  {certificate.fullName}
                </dd>
              </div>
              <div>
                <dt style={{ fontSize: 12.5, color: "var(--muted)", marginBottom: 4 }}>
                  Program
                </dt>
                <dd style={{ fontSize: 15, color: "var(--cream)" }}>
                  Strhni Dav — kompletný kurz
                </dd>
              </div>
              <div>
                <dt style={{ fontSize: 12.5, color: "var(--muted)", marginBottom: 4 }}>
                  Dátum vydania
                </dt>
                <dd style={{ fontSize: 15, color: "var(--cream)" }}>
                  {dateFormatter.format(certificate.issuedAt)}
                </dd>
              </div>
              <div>
                <dt style={{ fontSize: 12.5, color: "var(--muted)", marginBottom: 4 }}>
                  ID certifikátu
                </dt>
                <dd
                  style={{
                    fontFamily: "monospace",
                    fontSize: 12.5,
                    color: "var(--muted)",
                    wordBreak: "break-all",
                  }}
                >
                  {certificate.id}
                </dd>
              </div>
            </dl>
          </>
        ) : (
          <>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18 }}>
              <span
                style={{
                  width: 9,
                  height: 9,
                  borderRadius: "50%",
                  background: "var(--wine)",
                  flexShrink: 0,
                }}
              />
              <span
                style={{
                  fontFamily: "var(--font-label)",
                  fontWeight: 700,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  fontSize: 13,
                  color: "#d98d8d",
                }}
              >
                Certifikát nenájdený
              </span>
            </div>
            <p style={{ color: "var(--muted)", fontSize: 14.5, lineHeight: 1.65 }}>
              Toto ID nezodpovedá žiadnemu vydanému certifikátu Strhni Dav. Skontroluj, či si ho
              opísal/-a presne, alebo nás kontaktuj na{" "}
              <a href="mailto:juraj@jurajkurek.com" style={{ textDecoration: "underline" }}>
                juraj@jurajkurek.com
              </a>
              .
            </p>
          </>
        )}

        <Link
          href="/certifikat"
          style={{
            display: "inline-block",
            marginTop: 30,
            fontSize: 13.5,
            color: "var(--muted)",
            textDecoration: "underline",
          }}
        >
          Overiť iné ID
        </Link>
      </div>
    </main>
  );
}
