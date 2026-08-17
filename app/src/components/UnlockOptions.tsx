"use client";

import { useState } from "react";

type Block = {
  id: string;
  title: string;
  description: string | null;
  lessonCount: number;
  purchased: boolean;
};

const CONSENT_LABEL = (
  <>
    Žiadam o okamžité sprístupnenie zakúpených lekcií po úspešnej platbe a beriem na vedomie, že
    týmto strácam právo na odstúpenie od zmluvy vo vzťahu k lekciám, ktoré si pozriem pred
    uplynutím 14-dňovej lehoty na odstúpenie (čl. 7{" "}
    <a
      href="https://strhnidav.sk/obchodne-podmienky"
      target="_blank"
      rel="noopener noreferrer"
      className="underline hover:text-cream"
    >
      Obchodných podmienok
    </a>
    ).
  </>
);

export function UnlockOptions({
  blocks,
  coursePriceEur,
  blockPriceEur,
  subscriptionPriceEur,
}: {
  blocks: Block[];
  coursePriceEur: number;
  blockPriceEur: number;
  subscriptionPriceEur: number;
}) {
  const [consent, setConsent] = useState(false);
  // "course" | "subscription" | a section id | null
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function startCheckout(id: string, extra?: { sectionId?: string; plan?: "subscription" }) {
    setLoadingId(id);
    setError(null);
    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ consent: true, ...extra }),
      });
      const data = await res.json();
      if (!res.ok || !data.url) throw new Error(data.error ?? "Platbu sa nepodarilo spustiť.");
      window.location.href = data.url;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Niečo sa pokazilo.");
      setLoadingId(null);
    }
  }

  const purchasableBlocks = blocks.filter((b) => !b.purchased);

  return (
    <div>
      <div className="card mt-12 grid gap-12 p-12 md:grid-cols-[1fr_360px] md:items-start">
        <div>
          <div className="font-display text-[clamp(48px,6vw,72px)] font-semibold leading-none text-gold-bright">
            {coursePriceEur}
            <span className="ml-2 font-body text-[0.35em] font-medium text-muted">€ / celý kurz</span>
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
        <button
          onClick={() => startCheckout("course")}
          disabled={loadingId !== null || !consent}
          className="btn"
        >
          {loadingId === "course" ? "Presmerúvam na platbu…" : "Zaplatiť cez Stripe"}
        </button>
      </div>

      <div className="card mt-6 grid gap-8 p-10 sm:grid-cols-[1fr_auto] sm:items-center">
        <div>
          <div className="eyebrow mb-4">Alebo mesačne</div>
          <p className="font-display text-[30px] font-semibold leading-none text-gold-bright">
            {subscriptionPriceEur.toFixed(2).replace(".", ",")}
            <span className="ml-2 font-body text-[15px] font-medium text-muted">€ / mesiac</span>
          </p>
          <p className="mt-4 max-w-[52ch] text-[14.5px] leading-relaxed text-muted">
            Nemáš {coursePriceEur} € naraz? Plať postupne, mesiac po mesiaci — rovnaký obsah,
            rovnaké tempo (jedna lekcia denne), zrušiteľné kedykoľvek.
          </p>
        </div>
        <button
          onClick={() => startCheckout("subscription", { plan: "subscription" })}
          disabled={loadingId !== null || !consent}
          className="btn btn-ghost shrink-0"
        >
          {loadingId === "subscription" ? "Presmerúvam…" : "Predplatiť"}
        </button>
      </div>

      {purchasableBlocks.length > 0 && (
        <div className="mt-16">
          <div className="eyebrow mb-6">Alebo po jednotlivých blokoch</div>
          <p className="mb-8 max-w-[60ch] text-[15px] leading-relaxed text-muted">
            Nechceš celý kurz naraz? Kúp si len ten blok, ktorý ťa najviac zaujíma — každý za{" "}
            {blockPriceEur} €.
          </p>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            {purchasableBlocks.map((block) => (
              <div key={block.id} id={`blok-${block.id}`} className="card flex flex-col gap-4 p-7 scroll-mt-24">
                <div>
                  <p className="font-display text-[18px] font-medium leading-snug text-cream">
                    {block.title}
                  </p>
                  {block.description && (
                    <p className="mt-2 text-[13.5px] leading-relaxed text-muted">
                      {block.description}
                    </p>
                  )}
                  <p className="mt-3 text-[12.5px] uppercase tracking-wide text-muted">
                    {block.lessonCount} {block.lessonCount === 1 ? "lekcia" : "lekcií"}
                  </p>
                </div>
                <div className="mt-auto flex items-center justify-between gap-4 pt-2">
                  <span className="font-display text-[22px] font-semibold text-gold-bright">
                    {blockPriceEur} €
                  </span>
                  <button
                    onClick={() => startCheckout(block.id, { sectionId: block.id })}
                    disabled={loadingId !== null || !consent}
                    className="btn btn-sm"
                  >
                    {loadingId === block.id ? "Presmerúvam…" : "Kúpiť tento blok"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <label className="mt-12 flex items-start gap-3 text-sm text-muted">
        <input
          type="checkbox"
          checked={consent}
          onChange={(e) => setConsent(e.target.checked)}
          className="mt-0.5 h-4 w-4 shrink-0 accent-gold"
        />
        <span>{CONSENT_LABEL}</span>
      </label>
      {error && <p className="mt-3 text-xs text-[#d98d8d]">{error}</p>}
    </div>
  );
}
