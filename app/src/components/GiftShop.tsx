"use client";

import { useState } from "react";

type Block = { id: string; title: string; priceEur: number };

export function GiftShop({ blocks, coursePriceEur }: { blocks: Block[]; coursePriceEur: number }) {
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function buyGift(id: string, sectionId?: string) {
    setLoadingId(id);
    setError(null);
    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          giftCard: true,
          giftKind: sectionId ? "section" : "course",
          ...(sectionId ? { sectionId } : {}),
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.url) throw new Error(data.error ?? "Nepodarilo sa spustiť platbu.");
      window.location.href = data.url;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Niečo sa pokazilo.");
      setLoadingId(null);
    }
  }

  return (
    <div>
      {error && <p className="mb-4 text-xs text-[#d98d8d]">{error}</p>}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        <div className="card flex flex-col gap-4 p-7">
          <p className="font-display text-[18px] font-medium text-cream">Celý kurz</p>
          <span className="font-display text-[22px] font-semibold text-gold-bright">{coursePriceEur} €</span>
          <button onClick={() => buyGift("course")} disabled={loadingId !== null} className="btn btn-sm mt-auto">
            {loadingId === "course" ? "Presmerúvam…" : "Darovať celý kurz"}
          </button>
        </div>
        {blocks.map((block) => (
          <div key={block.id} className="card flex flex-col gap-4 p-7">
            <p className="font-display text-[18px] font-medium leading-snug text-cream">{block.title}</p>
            <span className="font-display text-[22px] font-semibold text-gold-bright">
              {block.priceEur % 1 === 0 ? block.priceEur : block.priceEur.toFixed(2).replace(".", ",")} €
            </span>
            <button
              onClick={() => buyGift(block.id, block.id)}
              disabled={loadingId !== null}
              className="btn btn-sm mt-auto"
            >
              {loadingId === block.id ? "Presmerúvam…" : "Darovať tento blok"}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
