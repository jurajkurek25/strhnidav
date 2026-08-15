const dateFormatter = new Intl.DateTimeFormat("sk-SK", {
  day: "numeric",
  month: "long",
  year: "numeric",
});

export function CertificateCard({
  fullName,
  issuedAt,
  id,
  qrDataUrl,
}: {
  fullName: string;
  issuedAt: Date;
  id: string;
  qrDataUrl: string;
}) {
  return (
    <div
      id="certificate"
      className="relative mx-auto w-full max-w-[900px] border border-card-line bg-card px-8 py-12 sm:px-16 sm:py-16"
    >
      <div className="pointer-events-none absolute inset-3 border border-gold/25" />

      <div className="relative flex flex-col items-center text-center">
        <div className="font-label text-[12px] font-bold uppercase tracking-[0.22em] text-gold sm:text-[13px]">
          Certifikát o absolvovaní
        </div>
        <div className="mt-3 font-label text-[14px] font-bold uppercase tracking-[0.15em] text-muted">
          Strhni<span className="text-gold">Dav</span>
        </div>

        <div className="mt-12 text-[13px] text-muted">Tento certifikát sa udeľuje</div>
        <h1 className="mt-3 max-w-[20ch] font-display text-[clamp(30px,5vw,50px)] font-semibold leading-tight text-cream text-balance">
          {fullName}
        </h1>
        <p className="mt-6 max-w-[44ch] text-[15px] leading-relaxed text-muted">
          za úspešné absolvovanie celého vzdelávacieho programu{" "}
          <span className="text-cream">Strhni Dav</span> v plnom rozsahu.
        </p>

        <div className="mt-14 grid w-full grid-cols-1 gap-10 border-t border-card-line pt-10 text-left sm:grid-cols-[1fr_1fr_auto] sm:items-end sm:gap-8">
          <div>
            <div className="font-label text-[11px] uppercase tracking-[0.12em] text-muted">Inštruktor</div>
            <div className="mt-1.5 font-display text-[17px] text-cream">Juraj Augustín Kurek</div>
            <div className="mt-4 font-label text-[11px] uppercase tracking-[0.12em] text-muted">Vydavateľ</div>
            <div className="mt-1.5 text-[14px] text-cream">Ngroup, s. r. o.</div>
          </div>

          <div>
            <div className="font-label text-[11px] uppercase tracking-[0.12em] text-muted">Dátum vydania</div>
            <div className="mt-1.5 text-[14px] text-cream">{dateFormatter.format(issuedAt)}</div>
            <div className="mt-4 font-label text-[11px] uppercase tracking-[0.12em] text-muted">ID certifikátu</div>
            <div className="mt-1.5 break-all font-mono text-[11.5px] text-cream">{id}</div>
          </div>

          <div className="flex flex-col items-start gap-2 sm:items-end">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={qrDataUrl}
              alt="QR kód na overenie certifikátu"
              width={96}
              height={96}
              className="rounded-sm"
            />
            <div className="text-[11px] leading-snug text-muted sm:text-right">
              Over na
              <br />
              kurz.strhnidav.sk/certifikat
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
