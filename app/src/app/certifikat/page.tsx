import { CertificateLookupForm } from "@/components/CertificateLookupForm";

export const metadata = {
  title: "Overenie certifikátu — Strhni Dav",
};

export default function CertifikatLookupPage() {
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
      <div className="card" style={{ padding: "48px", maxWidth: 460, width: "100%" }}>
        <div className="eyebrow" style={{ marginBottom: 22 }}>
          Overenie pravosti
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
          Over certifikát Strhni<span style={{ color: "var(--gold-bright)" }}>Dav</span>.
        </h1>
        <p style={{ color: "var(--muted)", fontSize: 15, lineHeight: 1.65 }}>
          Zadaj ID vytlačené na certifikáte, alebo naskenuj QR kód priamo z dokumentu — obe
          overia, že ide o skutočne vydaný certifikát absolvovania kurzu.
        </p>
        <CertificateLookupForm />
      </div>
    </main>
  );
}
